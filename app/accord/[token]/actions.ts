"use server";

import { and, eq, sql } from "drizzle-orm";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { playerConsents } from "@/lib/db/schema";
import { CONSENT_MAX_FAILED_CHECKS, consentValidUntil, toIsoDate } from "@/lib/licenses";
import { findConsentByToken } from "@/lib/queries/consents";
import { hitRateLimit, LIMITS, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type ConsentAnswerState = (ActionState & { done?: "ACCEPTED" | "REFUSED" }) | undefined;

const AnswerSchema = z.object({
  birthDate: z.iso.date({ error: "Date de naissance invalide." }),
  decision: z.enum(["accept", "refuse"]),
  refusalReason: z.string().trim().max(500).optional(),
  playForClub: z.literal("on").optional(),
  dataProcessing: z.literal("on").optional(),
  legalGuardian: z.literal("on").optional(),
});

/**
 * Réponse du joueur ou de son représentant légal (EF-ACC-03 à EF-ACC-05) :
 * vérification de la date de naissance, déclarations à cocher, accord ou refus motivé.
 */
export async function answerConsent(token: string, _state: ConsentAnswerState, formData: FormData): Promise<ConsentAnswerState> {
  const { limit, windowMs } = LIMITS.consentAnswerPerIp;
  const rl = await hitRateLimit(`consent:${await clientIp()}`, limit, windowMs);
  if (!rl.allowed) return { error: retryMessage(rl.retryAfterSec) };

  const found = await findConsentByToken(token);
  if (!found || found.state !== "open") return { error: "Ce lien n'est plus valable. Demandez au club une nouvelle demande d'accord." };
  const { consent, player } = found;

  const parsed = AnswerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const a = parsed.data;

  // Vérification d'identité par la date de naissance du joueur (EF-ACC-03).
  if (a.birthDate !== toIsoDate(player.birthDate)) {
    const [{ failedChecks }] = await db
      .update(playerConsents)
      .set({ failedChecks: sql`${playerConsents.failedChecks} + 1` })
      .where(eq(playerConsents.id, consent.id))
      .returning({ failedChecks: playerConsents.failedChecks });
    await logAudit({ userId: null, action: "CONSENT_CHECK_FAILED", entity: "player_consent", entityId: consent.id });
    const left = CONSENT_MAX_FAILED_CHECKS - failedChecks;
    return {
      error:
        left > 0
          ? `La date de naissance ne correspond pas. Il vous reste ${left} essai(s).`
          : "Trop d'essais erronés : ce lien est bloqué. Demandez au club une nouvelle demande.",
    };
  }

  const guardian = consent.recipient === "GUARDIAN";
  const now = new Date();
  const ip = await clientIp();

  if (a.decision === "refuse") {
    if (!a.refusalReason || a.refusalReason.length < 3) return { error: "Indiquez le motif du refus." };
    const updated = await db
      .update(playerConsents)
      .set({ status: "REFUSED", respondedAt: now, refusalReason: a.refusalReason, respondentIp: ip })
      .where(and(eq(playerConsents.id, consent.id), eq(playerConsents.status, "PENDING")))
      .returning({ id: playerConsents.id });
    if (updated.length === 0) return { error: "Cette demande a déjà reçu une réponse." };
    await logAudit({ userId: null, action: "CONSENT_REFUSED", entity: "player_consent", entityId: consent.id, details: { playerId: player.id } });
    return { done: "REFUSED" };
  }

  // Déclarations obligatoires (EF-ACC-04).
  if (!a.playForClub || !a.dataProcessing || (guardian && !a.legalGuardian)) {
    return { error: "Cochez toutes les déclarations pour donner votre accord." };
  }
  const updated = await db
    .update(playerConsents)
    .set({
      status: "ACCEPTED",
      respondedAt: now,
      validUntil: consentValidUntil(now),
      declarations: { playForClub: true, dataProcessing: true, ...(guardian && { legalGuardian: true }) },
      respondentIp: ip,
    })
    .where(and(eq(playerConsents.id, consent.id), eq(playerConsents.status, "PENDING")))
    .returning({ id: playerConsents.id });
  if (updated.length === 0) return { error: "Cette demande a déjà reçu une réponse." };

  await logAudit({ userId: null, action: "CONSENT_ACCEPTED", entity: "player_consent", entityId: consent.id, details: { playerId: player.id } });
  return { done: "ACCEPTED" };
}
