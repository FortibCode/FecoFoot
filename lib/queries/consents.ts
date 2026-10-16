import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, playerConsents, players } from "@/lib/db/schema";
import { CONSENT_MAX_FAILED_CHECKS } from "@/lib/licenses";
import { hashToken } from "@/lib/tokens";

export type ConsentLinkState = "open" | "expired" | "blocked" | "answered" | "cancelled";

/** Retrouve une demande d'accord à partir du lien personnel reçu par le joueur ou son tuteur. */
export async function findConsentByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ consent: playerConsents, player: players, club: clubs })
    .from(playerConsents)
    .innerJoin(players, eq(playerConsents.playerId, players.id))
    .innerJoin(clubs, eq(playerConsents.clubId, clubs.id))
    .where(eq(playerConsents.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;

  const { consent } = row;
  let state: ConsentLinkState = "open";
  if (consent.status === "CANCELLED") state = "cancelled";
  else if (consent.status !== "PENDING") state = "answered";
  else if (consent.failedChecks >= CONSENT_MAX_FAILED_CHECKS) state = "blocked";
  else if (consent.linkExpiresAt.getTime() < Date.now()) state = "expired";
  return { ...row, state };
}
