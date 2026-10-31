"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { PRESS_ROLES, PRESS_ZONE_LABELS, PRESS_ZONES, quotaError, type PressZone } from "@/lib/accreditations";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { accreditationQuotas, accreditations, ticketEvents } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { imageSize } from "@/lib/image-size";
import { notify } from "@/lib/notify";
import { isUniqueViolation } from "@/lib/queries/players";
import { deleteFile, putFile } from "@/lib/storage";
import { normalizeCongoPhone } from "@/lib/supporters";

const path = (eventId: number) => `/admin/accreditations?event=${eventId}`;
const done = (acc: { id: number; eventId: number }) => {
  revalidatePath(path(acc.eventId));
  revalidatePath(`/admin/accreditations/${acc.id}`);
};

/**
 * Validation avec choix des zones, ou refus motivé (EF-MED-03), dans le respect des quotas (EF-MED-05).
 * Le match est verrouillé pendant la décision : deux validations simultanées ne dépassent pas un quota.
 */
export async function decideAccreditation(accreditationId: number, approve: boolean, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const zones = formData.getAll("zones").map(String).filter((z): z is PressZone => (PRESS_ZONES as readonly string[]).includes(z));
  const reason = String(formData.get("reason") ?? "").trim();
  if (approve && zones.length === 0) return { error: "Cochez au moins une zone à accorder." };
  if (!approve && reason.length < 3) return { error: "Indiquez le motif du refus." };

  const outcome = await db.transaction(async (tx) => {
    const [acc] = await tx.select().from(accreditations).where(eq(accreditations.id, accreditationId)).limit(1);
    if (!acc) return { error: "Demande introuvable." };
    await tx.select({ id: ticketEvents.id }).from(ticketEvents).where(eq(ticketEvents.id, acc.eventId)).for("update");
    if (approve) {
      const quotas = Object.fromEntries(
        (await tx.select().from(accreditationQuotas).where(eq(accreditationQuotas.eventId, acc.eventId))).map((q) => [q.zone, q.quota]),
      );
      const counts = await tx
        .select({ zone: sql<PressZone>`unnest(${accreditations.grantedZones})`, n: sql<number>`count(*)::int` })
        .from(accreditations)
        .where(and(eq(accreditations.eventId, acc.eventId), eq(accreditations.status, "APPROVED"), ne(accreditations.id, acc.id)))
        .groupBy(sql`1`);
      const granted = Object.fromEntries(counts.map((c) => [c.zone, c.n]));
      const quota = quotaError(zones, granted, quotas);
      if (quota) return { error: quota };
    }
    await tx
      .update(accreditations)
      .set({
        status: approve ? "APPROVED" : "REFUSED",
        grantedZones: approve ? zones : null,
        decisionReason: approve ? null : reason,
        decidedBy: user.id,
        decidedAt: new Date(),
      })
      .where(eq(accreditations.id, accreditationId));
    return { acc };
  });
  if ("error" in outcome) return { error: outcome.error };
  const { acc } = outcome;

  await notify(
    { phone: acc.phone, email: acc.email },
    {
      topic: "accreditation_decision",
      subject: `FECOFOOT — accréditation ${acc.number} ${approve ? "approuvée" : "refusée"}`,
      sms: approve
        ? `FECOFOOT : accréditation ${acc.number} approuvée (${zones.map((z) => PRESS_ZONE_LABELS[z]).join(", ")}). Votre badge est disponible avec votre lien de suivi.`
        : `FECOFOOT : accréditation ${acc.number} refusée. Motif : ${reason}`,
      email: approve
        ? `Votre accréditation ${acc.number} est approuvée pour : ${zones.map((z) => PRESS_ZONE_LABELS[z]).join(", ")}.\nVotre badge numérique (QR code) est disponible avec le lien de suivi reçu lors de votre demande.\n\nService communication — FECOFOOT`
        : `Votre demande d'accréditation ${acc.number} est refusée.\nMotif : ${reason}\n\nService communication — FECOFOOT`,
    },
  );
  await logAudit({
    userId: user.id,
    action: approve ? "ACCREDITATION_APPROVED" : "ACCREDITATION_REFUSED",
    entity: "accreditation",
    entityId: accreditationId,
    details: approve ? { zones } : { reason },
  });
  done(acc);
  return { success: approve ? "Accréditation approuvée." : "Demande refusée." };
}

/** Quotas par zone pour un match (EF-MED-05) ; vide = sans limite. */
export async function saveQuotas(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const values: Record<string, number | null> = {};
  for (const zone of PRESS_ZONES) {
    const raw = String(formData.get(`quota_${zone}`) ?? "").trim();
    const n = raw === "" ? null : z.coerce.number().int().min(0).max(10_000).safeParse(raw).data;
    if (n === undefined) return { error: `Quota invalide pour « ${PRESS_ZONE_LABELS[zone]} ».` };
    values[zone] = n;
  }
  await db.transaction(async (tx) => {
    await tx.delete(accreditationQuotas).where(eq(accreditationQuotas.eventId, eventId));
    const rows = Object.entries(values)
      .filter((e): e is [PressZone, number] => e[1] !== null)
      .map(([zone, quota]) => ({ eventId, zone, quota }));
    if (rows.length) await tx.insert(accreditationQuotas).values(rows);
  });
  await logAudit({ userId: user.id, action: "ACCREDITATION_QUOTAS", entity: "ticket_event", entityId: eventId, details: values });
  revalidatePath(path(eventId));
  return { success: "Quotas enregistrés." };
}

const EditSchema = z.object({
  lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
  firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
  phone: z.string(),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  outlet: z.string().trim().min(2, { error: "Organe de presse requis." }).max(160),
  role: z.enum(PRESS_ROLES, { error: "Fonction requise." }),
  // Vide pour un journaliste accrédité sur ordre de mission de son média (sans carte de presse).
  pressCardNumber: z.preprocess(blankToNull, z.string().trim().toUpperCase().min(3, { error: "Numéro trop court." }).max(40).nullable()),
});

/** Correction de la fiche d'un membre de la presse (identité, média, fonction, carte, contacts). */
export async function updateAccreditation(accreditationId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const parsed = EditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const phone = normalizeCongoPhone(parsed.data.phone);
  if (!phone) return { error: "Numéro de téléphone congolais invalide.", fieldErrors: { phone: ["Numéro invalide (ex. 06 123 45 67)."] } };
  try {
    const [acc] = await db
      .update(accreditations)
      .set({ ...parsed.data, lastName: parsed.data.lastName.toUpperCase(), phone })
      .where(eq(accreditations.id, accreditationId))
      .returning({ id: accreditations.id, eventId: accreditations.eventId });
    if (!acc) return { error: "Demande introuvable." };
    await logAudit({ userId: user.id, action: "UPDATE", entity: "accreditation", entityId: accreditationId, details: { outlet: parsed.data.outlet, role: parsed.data.role } });
    done(acc);
  } catch (e) {
    if (isUniqueViolation(e, "accreditations_event_phone_uq")) return { error: "Une autre demande existe déjà avec ce numéro pour ce match." };
    throw e;
  }
  return { success: "Fiche mise à jour." };
}

/** Remplacement de la photo du badge : JPEG ou PNG de 5 Mo au plus, type vérifié d'après le contenu. */
export async function replaceAccreditationPhoto(accreditationId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une photo." };
  if (file.size > MAX_FILE_SIZE) return { error: "La photo dépasse 5 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes);
  if ((kind !== "jpeg" && kind !== "png") || !imageSize(bytes)) return { error: "Photo non acceptée : JPEG ou PNG." };
  const [acc] = await db.select().from(accreditations).where(eq(accreditations.id, accreditationId)).limit(1);
  if (!acc) return { error: "Demande introuvable." };
  const photoKey = `accreditations/${acc.eventId}/${randomUUID()}.${kind}`;
  await putFile(photoKey, bytes);
  await db.update(accreditations).set({ photoKey, photoType: MIME[kind] }).where(eq(accreditations.id, accreditationId));
  if (acc.photoKey) await deleteFile(acc.photoKey);
  await logAudit({ userId: user.id, action: "ACCREDITATION_PHOTO", entity: "accreditation", entityId: accreditationId });
  done(acc);
  return { success: "Photo remplacée." };
}

/**
 * Suppression d'une demande (doublon, erreur de saisie). Refusée si le badge a déjà servi au stade :
 * les entrées restent dans l'historique, on retire alors l'accréditation (refus motivé) au lieu de la supprimer.
 */
export async function deleteAccreditation(accreditationId: number): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const [acc] = await db.select().from(accreditations).where(eq(accreditations.id, accreditationId)).limit(1);
  if (!acc) return { error: "Demande introuvable." };
  if (acc.entries > 0) return { error: `Ce badge a déjà servi au stade (${acc.entries} entrée(s)) : retirez l'accréditation au lieu de la supprimer.` };
  await db.delete(accreditations).where(eq(accreditations.id, accreditationId));
  if (acc.photoKey) await deleteFile(acc.photoKey);
  if (acc.proofKey) await deleteFile(acc.proofKey).catch(() => undefined);
  await logAudit({ userId: user.id, action: "DELETE", entity: "accreditation", entityId: accreditationId, details: { number: acc.number, name: `${acc.firstName} ${acc.lastName}`, outlet: acc.outlet } });
  revalidatePath(path(acc.eventId));
  return { success: "Demande supprimée." };
}

/** Suppression depuis la fiche : retour à la liste du match. */
export async function deleteAccreditationAndReturn(accreditationId: number, eventId: number): Promise<ActionState> {
  await requirePermission("communication.manage");
  const result = await deleteAccreditation(accreditationId);
  if (result?.error) return result;
  redirect(path(eventId));
}
