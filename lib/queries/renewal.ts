import "server-only";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { licenses, players } from "@/lib/db/schema";
import { categoryError, naturalCategory, type Category, type LicenseType } from "@/lib/licenses";

export type RenewalCandidate = {
  playerId: number;
  federalId: string;
  lastName: string;
  firstName: string;
  birthDate: Date;
  previousNumber: string;
  previousCategory: Category;
  type: LicenseType;
  category: Category;
};

/**
 * Joueurs du club licenciés la saison précédente (licence validée, suspendue ou expirée)
 * et encore sans licence active pour la nouvelle saison (EF-LIC-10).
 */
export async function renewalCandidates(clubId: number, season: number): Promise<RenewalCandidate[]> {
  const alreadyThisSeason = db
    .select({ id: licenses.playerId })
    .from(licenses)
    .where(and(eq(licenses.season, season), notInArray(licenses.status, ["REJECTED", "TRANSFERRED"])));

  const rows = await db
    .select({
      playerId: players.id,
      federalId: players.federalId,
      lastName: players.lastName,
      firstName: players.firstName,
      birthDate: players.birthDate,
      previousNumber: licenses.number,
      previousCategory: licenses.category,
      type: licenses.type,
    })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .where(
      and(
        eq(licenses.season, season - 1),
        eq(players.clubId, clubId),
        eq(licenses.clubId, clubId),
        inArray(licenses.status, ["VALIDATED", "SUSPENDED", "EXPIRED"]),
        sql`${players.id} not in (${alreadyThisSeason})`,
      ),
    )
    .orderBy(asc(players.lastName), asc(players.firstName));

  // Catégorie de la nouvelle saison : on garde un surclassement encore autorisé, sinon la catégorie d'âge.
  return rows.map((r) => ({
    ...r,
    category: categoryError(r.birthDate, season, r.previousCategory) === null ? r.previousCategory : naturalCategory(r.birthDate, season),
  }));
}
