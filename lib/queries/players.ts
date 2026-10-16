import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/guard";
import { canAccessClub } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, licenses, playerConsents, players } from "@/lib/db/schema";
import { isConsentValid } from "@/lib/licenses";

/**
 * Accès aux joueurs et licences selon le périmètre (EF-CLB-04) :
 * le périmètre d'un joueur est celui de son club actuel.
 */

export async function loadClubFor(user: CurrentUser, clubId: number) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club || !canAccessClub(user, club)) return null;
  return club;
}

export async function loadPlayerFor(user: CurrentUser, playerId: number) {
  const [row] = await db
    .select({ player: players, club: clubs })
    .from(players)
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(players.id, playerId))
    .limit(1);
  if (!row) return null;
  const federal = user.role === "SUPER_ADMIN" || user.role === "FEDERATION_ADMIN" || user.role === "DTN";
  if (!federal && (!row.club || !canAccessClub(user, row.club))) redirect("/admin/acces-refuse");
  return row;
}

export async function loadLicenseFor(user: CurrentUser, licenseId: number) {
  const [row] = await db
    .select({ license: licenses, player: players, club: clubs })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .innerJoin(clubs, eq(licenses.clubId, clubs.id))
    .where(eq(licenses.id, licenseId))
    .limit(1);
  if (!row) return null;
  if (!canAccessClub(user, row.club) && user.role !== "SUPER_ADMIN" && user.role !== "FEDERATION_ADMIN") {
    redirect("/admin/acces-refuse");
  }
  return row;
}

/** Dernier accord du joueur pour ce club, et s'il permet de valider une licence (RG-05). */
export async function latestConsent(playerId: number, clubId: number) {
  const [consent] = await db
    .select()
    .from(playerConsents)
    .where(and(eq(playerConsents.playerId, playerId), eq(playerConsents.clubId, clubId)))
    .orderBy(desc(playerConsents.requestedAt))
    .limit(1);
  return { consent, valid: isConsentValid(consent, clubId) };
}

/** Dernier accord ACCEPTÉ encore valable (une demande en cours n'annule pas un accord déjà donné). */
export async function validConsentExists(playerId: number, clubId: number) {
  const rows = await db
    .select()
    .from(playerConsents)
    .where(and(eq(playerConsents.playerId, playerId), eq(playerConsents.clubId, clubId), eq(playerConsents.status, "ACCEPTED")))
    .orderBy(desc(playerConsents.respondedAt))
    .limit(1);
  return isConsentValid(rows[0], clubId);
}

/** Violation d'une contrainte d'unicité PostgreSQL (doublon). */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = (e as { cause?: unknown })?.cause ?? e;
  const pg = err as { code?: string; constraint_name?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint_name === constraint);
}
