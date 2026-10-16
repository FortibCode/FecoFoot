import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, licenses, players } from "@/lib/db/schema";
import { effectiveStatus } from "@/lib/licenses";

/** Données publiques d'une licence (EF-PUB-06) : aucune date de naissance ni coordonnée. */
export async function publicLicense(by: { token: string } | { number: string }) {
  const where = "token" in by ? eq(licenses.verifyToken, by.token) : eq(licenses.number, by.number.trim().toUpperCase());
  const [row] = await db
    .select({
      number: licenses.number,
      season: licenses.season,
      category: licenses.category,
      type: licenses.type,
      status: licenses.status,
      expiresAt: licenses.expiresAt,
      lastName: players.lastName,
      firstName: players.firstName,
      federalId: players.federalId,
      club: clubs.name,
    })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .innerJoin(clubs, eq(licenses.clubId, clubs.id))
    .where(where)
    .limit(1);
  if (!row) return null;
  return { ...row, status: effectiveStatus(row.status, row.expiresAt) };
}

export type PublicLicense = NonNullable<Awaited<ReturnType<typeof publicLicense>>>;
