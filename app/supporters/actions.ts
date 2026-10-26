"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { createFanSession, deleteFanSession, requireSupporter } from "@/lib/auth/fan-session";
import { isLocked, registerFailure } from "@/lib/auth/lockout";
import { MIN_SUPPORTER_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { fanIdSeq, membershipPlans, memberships, payments, supporters } from "@/lib/db/schema";
import { confirmPayment, failPayment, paymentMode, startPayment } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/payments-rules";
import { isUniqueViolation } from "@/lib/queries/players";
import { hitRateLimit, peekRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { nextVal } from "@/lib/sequences";
import { saveSupporterPhoto } from "@/lib/supporter-photo";
import { ageAt, seasonOf } from "@/lib/licenses";
import { formatFanId, ID_DOCUMENT_TYPES, MEMBERSHIP_TIERS, MIN_FAN_AGE, normalizeCongoPhone, tierError } from "@/lib/supporters";

const phoneField = z.string().transform((v, ctx) => {
  const phone = normalizeCongoPhone(v);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Numéro congolais invalide (ex. 06 123 45 67)." });
    return z.NEVER;
  }
  return phone;
});

const SignupSchema = z.object({
  lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
  firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
  birthDate: z.iso.date({ error: "Date de naissance invalide." }),
  phone: phoneField,
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  idDocumentType: z.enum(ID_DOCUMENT_TYPES, { error: "Type de pièce requis." }),
  idDocumentNumber: z.string().trim().toUpperCase().min(4, { error: "Numéro de pièce requis." }).max(40),
  password: z.string(),
  consent: z.literal("on", { error: "Le consentement est obligatoire pour créer un Fan ID." }),
});

/** Création du Fan ID en ligne (EF-SUP-01). */
export async function registerSupporter(_state: ActionState, formData: FormData): Promise<ActionState> {
  const rl = await hitRateLimit(`fan-signup:${await clientIp()}`, 10, 60 * 60_000);
  if (!rl.allowed) return { error: retryMessage(rl.retryAfterSec) };

  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const policy = passwordPolicyError(d.password, MIN_SUPPORTER_PASSWORD_LENGTH);
  if (policy) return { error: policy, fieldErrors: { password: [policy] } };
  const birthDate = new Date(`${d.birthDate}T00:00:00Z`);
  if (ageAt(birthDate) < MIN_FAN_AGE) {
    return { error: `Il faut avoir au moins ${MIN_FAN_AGE} ans pour créer un Fan ID en ligne. Présentez-vous au guichet avec un adulte.` };
  }

  let created: { id: number; fanId: string; sessionVersion: number };
  try {
    [created] = await db
      .insert(supporters)
      .values({
        fanId: formatFanId(await nextVal(fanIdSeq)),
        lastName: d.lastName.toUpperCase(),
        firstName: d.firstName,
        birthDate,
        phone: d.phone,
        email: d.email,
        passwordHash: await bcrypt.hash(d.password, 12),
        idDocumentType: d.idDocumentType,
        idDocumentNumber: d.idDocumentNumber,
        consentAt: new Date(),
      })
      .returning({ id: supporters.id, fanId: supporters.fanId, sessionVersion: supporters.sessionVersion });
  } catch (e) {
    if (isUniqueViolation(e, "supporters_phone_uq")) return { error: "Un Fan ID existe déjà avec ce numéro. Connectez-vous.", fieldErrors: { phone: ["Numéro déjà utilisé."] } };
    if (isUniqueViolation(e, "supporters_id_document_uq")) return { error: "Un Fan ID existe déjà pour cette pièce d'identité." };
    throw e;
  }
  await logAudit({ userId: null, action: "FAN_ID_CREATED", entity: "supporter", entityId: created.id, details: { fanId: created.fanId } });
  await createFanSession(created.id, created.sessionVersion);
  redirect("/supporters/espace");
}

/** Connexion supporter : téléphone + mot de passe, verrouillage après 5 échecs, limitation par IP. */
export type FanLoginState = { error?: string; phone?: string } | undefined;

export async function loginSupporter(_state: FanLoginState, formData: FormData): Promise<FanLoginState> {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizeCongoPhone(raw);
  const password = String(formData.get("password") ?? "");
  const ipKey = `fan-login-fail:${await clientIp()}`;
  const probe = await peekRateLimit(ipKey, 30, 15 * 60_000);
  if (!probe.allowed) return { error: retryMessage(probe.retryAfterSec), phone: raw };
  const invalid = { error: "Numéro ou mot de passe incorrect.", phone: raw };
  if (!phone) return invalid;

  const [s] = await db.select().from(supporters).where(eq(supporters.phone, phone)).limit(1);
  if (!s) {
    await hitRateLimit(ipKey, 30, 15 * 60_000);
    return invalid;
  }
  if (isLocked(s.lockedUntil)) return { error: "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.", phone: raw };
  if (!(await bcrypt.compare(password, s.passwordHash))) {
    await hitRateLimit(ipKey, 30, 15 * 60_000);
    await db.update(supporters).set(registerFailure(s.failedLoginCount)).where(eq(supporters.id, s.id));
    return invalid;
  }
  await db.update(supporters).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(supporters.id, s.id));
  await createFanSession(s.id, s.sessionVersion);
  redirect("/supporters/espace");
}

export async function logoutSupporter(): Promise<void> {
  await deleteFanSession();
  redirect("/supporters");
}

/** Adhésion annuelle au club des supporters, payée par Mobile Money (EF-SUP-03). */
export async function startMembership(_state: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSupporter();
  const tier = z.enum(MEMBERSHIP_TIERS).safeParse(formData.get("tier"));
  const method = z.enum(PAYMENT_METHODS).exclude(["CASH"]).safeParse(formData.get("method"));
  if (!tier.success) return { error: "Choisissez une formule." };
  if (!method.success) return { error: "Choisissez Airtel Money ou MTN MoMo." };

  const season = seasonOf();
  const [plan] = await db
    .select()
    .from(membershipPlans)
    .where(and(eq(membershipPlans.season, season), eq(membershipPlans.tier, tier.data), eq(membershipPlans.open, true)))
    .limit(1);
  if (!plan) return { error: "Les adhésions ne sont pas ouvertes pour cette formule." };
  const tierProblem = tierError(tier.data, s.birthDate, season);
  if (tierProblem) return { error: tierProblem };
  const [active] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.supporterId, s.id), eq(memberships.season, season), eq(memberships.status, "ACTIVE")))
    .limit(1);
  if (active) return { error: "Vous êtes déjà membre pour cette saison." };

  const [m] = await db.insert(memberships).values({ supporterId: s.id, season, tier: tier.data, price: plan.price }).returning({ id: memberships.id });
  const { reference } = await startPayment({ purpose: "MEMBERSHIP", targetId: m.id, amount: plan.price, method: method.data, phone: s.phone, supporterId: s.id });
  redirect(`/paiement/${reference}`);
}

/** Page de paiement : confirmation (simulation) ou annulation par le payeur. */
export async function answerSimulatedPayment(reference: string, accept: boolean): Promise<ActionState> {
  const s = await requireSupporter();
  const [p] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p || p.supporterId !== s.id) return { error: "Paiement introuvable." };
  if (paymentMode() !== "simulation") return { error: "La confirmation se fait sur votre téléphone." };
  if (!accept) {
    await failPayment(reference, "Refusé par le payeur");
    return { error: "Paiement refusé." };
  }
  const result = await confirmPayment(reference);
  if (result === "expired") return { error: "Le délai de 15 minutes est dépassé : recommencez." };
  if (result === "not_pending") return { error: "Ce paiement a déjà été traité." };
  await logAudit({ userId: null, action: "PAYMENT_CONFIRMED", entity: "payment", entityId: reference, details: { supporterId: s.id, simulated: true } });
  redirect(p.purpose === "TICKET_ORDER" ? "/supporters/espace?achat=ok" : p.purpose === "MEMBERSHIP" ? "/supporters/espace?adhesion=ok" : "/supporters/espace");
}


/** Photo d'identité du supporter, exigée avant son premier achat en ligne (EF-SUP-08). */
export async function uploadMyPhoto(_state: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSupporter();
  const result = await saveSupporterPhoto(s.id, formData.get("file"));
  if ("error" in result) return { error: result.error };
  await logAudit({ userId: null, action: "SUPPORTER_PHOTO", entity: "supporter", entityId: s.id, details: { by: "supporter" } });
  revalidatePath("/supporters/espace");
  return { success: "Photo enregistrée." };
}
