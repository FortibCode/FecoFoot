"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { PRESS_ROLES, PRESS_ZONES, requestError, formatAccreditationNumber } from "@/lib/accreditations";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { accreditationNumberSeq, accreditations, ticketEvents } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/qr";
import { isUniqueViolation } from "@/lib/queries/players";
import { hitRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { nextVal } from "@/lib/sequences";
import { normalizeCongoPhone } from "@/lib/supporters";
import { hashToken, randomToken } from "@/lib/tokens";

const RequestSchema = z.object({
  lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
  firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
  phone: z.string(),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  outlet: z.string().trim().min(2, { error: "Organe de presse requis." }).max(160),
  role: z.enum(PRESS_ROLES, { error: "Fonction requise." }),
  pressCardNumber: z.string().trim().toUpperCase().min(3, { error: "Numéro de carte de presse requis." }).max(40),
});

/** Demande d'accréditation en ligne pour un match (EF-MED-01, EF-MED-02). */
export async function requestAccreditation(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const rl = await hitRateLimit(`accreditation:${await clientIp()}`, 20, 60 * 60_000);
  if (!rl.allowed) return { error: retryMessage(rl.retryAfterSec) };

  const parsed = RequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const phone = normalizeCongoPhone(parsed.data.phone);
  if (!phone) return { error: "Numéro de téléphone congolais invalide.", fieldErrors: { phone: ["Numéro invalide (ex. 06 123 45 67)."] } };
  const zones = formData.getAll("zones").map(String);

  const [event] = await db.select().from(ticketEvents).where(eq(ticketEvents.id, eventId)).limit(1);
  if (!event || event.salesStatus === "DRAFT") return { error: "Match introuvable." };
  const problem = requestError({ kickoffAt: event.kickoffAt, eventCancelled: event.salesStatus === "CANCELLED", zones });
  if (problem) return { error: problem };

  const tracking = randomToken();
  let created: { id: number; number: string };
  try {
    [created] = await db
      .insert(accreditations)
      .values({
        ...parsed.data,
        lastName: parsed.data.lastName.toUpperCase(),
        phone,
        eventId,
        number: formatAccreditationNumber(await nextVal(accreditationNumberSeq)),
        requestedZones: zones as (typeof PRESS_ZONES)[number][],
        trackingHash: hashToken(tracking),
        badgeToken: randomToken(),
      })
      .returning({ id: accreditations.id, number: accreditations.number });
  } catch (e) {
    if (isUniqueViolation(e, "accreditations_event_phone_uq")) return { error: "Une demande existe déjà avec ce numéro pour ce match." };
    throw e;
  }

  const link = await appUrl(`/accreditations/suivi/${tracking}`);
  await notify(
    { phone, email: parsed.data.email },
    {
      topic: "accreditation_request",
      subject: `FECOFOOT — demande d'accréditation ${created.number}`,
      sms: `FECOFOOT : demande d'accréditation ${created.number} reçue (${event.title}). Suivi et badge : ${link}`,
      email: `Votre demande d'accréditation ${created.number} pour ${event.title} (${formatDateTime(event.kickoffAt)}) a bien été reçue.\nSuivez son traitement et récupérez votre badge ici :\n\n${link}\n\nService communication — FECOFOOT`,
    },
  );
  await logAudit({ userId: null, action: "ACCREDITATION_REQUEST", entity: "accreditation", entityId: created.id, details: { eventId, number: created.number } });
  redirect(`/accreditations/suivi/${tracking}`);
}
