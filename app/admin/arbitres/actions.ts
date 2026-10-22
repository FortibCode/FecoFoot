"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { sendPasswordLink } from "@/lib/auth/reset-link";
import { db } from "@/lib/db";
import { blockedMessage, deleteRefereeRecord, refereeBlockers } from "@/lib/deletion";
import { referees, users } from "@/lib/db/schema";
import { parseScope, REFEREE_GRADES } from "@/lib/referees";
import { randomToken } from "@/lib/tokens";

const RefereeSchema = z.object({
  lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
  firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
  grade: z.enum(REFEREE_GRADES, { error: "Grade requis." }),
  scope: z.preprocess(parseScope, z.object({ leagueId: z.number().nullable(), championshipId: z.number().nullable() }, { error: "Rattachement invalide." })),
  phone: z.preprocess(blankToNull, z.string().trim().max(32).nullable()),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

const refereeValues = ({ scope, ...d }: z.infer<typeof RefereeSchema>) => ({ ...d, ...scope, lastName: d.lastName.toUpperCase() });

/** Registre des arbitres (EF-ARB-01). */
export async function createReferee(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("refereeing.manage");
  const parsed = RefereeSchema.safeParse({ ...Object.fromEntries(formData), active: "on" });
  if (!parsed.success) return fromZodError(parsed.error);
  const [created] = await db
    .insert(referees)
    .values(refereeValues(parsed.data))
    .returning({ id: referees.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "referee", entityId: created.id });
  revalidatePath("/admin/arbitres");
  redirect(`/admin/arbitres/${created.id}`);
}

export async function updateReferee(refereeId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("refereeing.manage");
  const parsed = RefereeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [ref] = await db
    .update(referees)
    .set(refereeValues(parsed.data))
    .where(eq(referees.id, refereeId))
    .returning({ userId: referees.userId });
  // Un arbitre inactif perd l'accès à son espace.
  if (ref?.userId) await db.update(users).set({ active: parsed.data.active }).where(eq(users.id, ref.userId));
  await logAudit({ userId: user.id, action: "UPDATE", entity: "referee", entityId: refereeId });
  revalidatePath(`/admin/arbitres/${refereeId}`);
  return { success: "Fiche mise à jour." };
}

/** Ouvre l'espace personnel de l'arbitre (EF-ARB-04) : compte « Arbitre / commissaire » + lien pour choisir son mot de passe. */
export async function openRefereeAccess(refereeId: number): Promise<ActionState> {
  const admin = await requirePermission("refereeing.manage");
  const [ref] = await db.select().from(referees).where(eq(referees.id, refereeId)).limit(1);
  if (!ref) return { error: "Arbitre introuvable." };
  if (ref.userId) return { error: "L'accès est déjà ouvert." };
  if (!ref.email) return { error: "Renseignez d'abord l'adresse e-mail de l'arbitre (identifiant de connexion)." };
  const email = ref.email.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "Un compte existe déjà avec cette adresse e-mail." };

  const fullName = `${ref.firstName} ${ref.lastName}`;
  // Mot de passe aléatoire inconnu de tous : l'arbitre choisit le sien avec le lien reçu.
  const [account] = await db
    .insert(users)
    .values({ email, fullName, phone: ref.phone, role: "REFEREE", passwordHash: await bcrypt.hash(randomToken(), 12) })
    .returning({ id: users.id, email: users.email, phone: users.phone, fullName: users.fullName });
  await db.update(referees).set({ userId: account.id }).where(eq(referees.id, refereeId));
  await sendPasswordLink(account, "welcome", 7 * 86_400_000);
  await logAudit({ userId: admin.id, action: "REFEREE_ACCESS", entity: "referee", entityId: refereeId, details: { userId: account.id } });
  revalidatePath(`/admin/arbitres/${refereeId}`);
  return { success: `Accès ouvert : un lien pour choisir son mot de passe a été envoyé à ${email}.` };
}

/** Suppression d'un officiel jamais désigné (sinon : le désactiver). */
export async function deleteReferee(refereeId: number): Promise<ActionState> {
  const user = await requirePermission("refereeing.manage");
  const reasons = await refereeBlockers(refereeId);
  if (reasons.length) return { error: `${blockedMessage("L'officiel", reasons)} Désactivez-le plutôt depuis sa fiche.` };
  await deleteRefereeRecord(refereeId);
  await logAudit({ userId: user.id, action: "DELETE", entity: "referee", entityId: refereeId });
  revalidatePath("/admin/arbitres");
  return { success: "Officiel supprimé." };
}
