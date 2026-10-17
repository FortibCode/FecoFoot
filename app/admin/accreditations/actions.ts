"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { PRESS_ZONE_LABELS, PRESS_ZONES, quotaError, type PressZone } from "@/lib/accreditations";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { accreditationQuotas, accreditations, ticketEvents } from "@/lib/db/schema";
import { notify } from "@/lib/notify";

const path = (eventId: number) => `/admin/accreditations?event=${eventId}`;

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
  revalidatePath(path(acc.eventId));
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
