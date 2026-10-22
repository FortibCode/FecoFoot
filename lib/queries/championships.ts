import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { championshipDocuments, championshipOfficials, championships, clubs, competitions, competitionTeams, leagues } from "@/lib/db/schema";

/** Championnats nationaux, du plus haut niveau au plus bas, avec leurs saisons (la plus récente d'abord). */
export async function championshipsWithSeasons(opts: { published?: boolean } = {}) {
  const [list, seasons] = await Promise.all([
    db.select().from(championships).where(opts.published ? eq(championships.active, true) : undefined).orderBy(asc(championships.tier)),
    db
      .select({ c: competitions, teams: count(competitionTeams.id) })
      .from(competitions)
      .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
      .where(opts.published ? ne(competitions.status, "DRAFT") : undefined)
      .groupBy(competitions.id)
      .orderBy(desc(competitions.season)),
  ]);
  return list.map((ch) => ({ ...ch, seasons: seasons.filter((s) => s.c.championshipId === ch.id) }));
}

export async function championshipByCode(code: string) {
  const [ch] = await db.select().from(championships).where(eq(championships.code, code.toLowerCase())).limit(1);
  return ch ?? null;
}

/** Saison d'un championnat : celle demandée, sinon la plus récente (publiée seulement pour le portail). */
export async function championshipSeason(championshipId: number, season: number | undefined, opts: { published?: boolean } = {}) {
  const editions = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.championshipId, championshipId), opts.published ? ne(competitions.status, "DRAFT") : undefined))
    .orderBy(desc(competitions.season));
  const current = (season && editions.find((e) => e.season === season)) || editions[0] || null;
  return { editions, current };
}

/** Clubs engagés dans une saison : ligue d'origine, poule (zone / groupe), statut sportif. */
export async function seasonTeams(competitionId: number) {
  return db
    .select({
      clubId: clubs.id,
      name: clubs.name,
      slug: clubs.slug,
      city: clubs.city,
      league: leagues.name,
      pool: competitionTeams.pool,
      outcome: competitionTeams.outcome,
      registeredAt: competitionTeams.registeredAt,
    })
    .from(competitionTeams)
    .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
    .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
    .where(eq(competitionTeams.competitionId, competitionId))
    .orderBy(asc(competitionTeams.pool), asc(clubs.name));
}

/** Responsables (en fonction d'abord, puis l'historique des mandats clos) d'un championnat et de la structure commune. */
export async function championshipOfficialsOf(championshipId: number) {
  return db
    .select()
    .from(championshipOfficials)
    .where(or(eq(championshipOfficials.championshipId, championshipId), isNull(championshipOfficials.championshipId)))
    .orderBy(asc(championshipOfficials.status), desc(championshipOfficials.startDate));
}

export async function championshipDocumentsOf(championshipId: number, opts: { published?: boolean } = {}) {
  return db
    .select()
    .from(championshipDocuments)
    .where(and(eq(championshipDocuments.championshipId, championshipId), opts.published ? eq(championshipDocuments.published, true) : undefined))
    .orderBy(desc(championshipDocuments.season), desc(championshipDocuments.createdAt));
}

/** Participations d'un club, toutes saisons : compétition, championnat, poule, statut sportif. */
export async function clubParticipations(clubId: number) {
  return db
    .select({
      competitionId: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      season: competitions.season,
      status: competitions.status,
      championship: championships.name,
      championshipCode: championships.code,
      pool: competitionTeams.pool,
      outcome: competitionTeams.outcome,
    })
    .from(competitionTeams)
    .innerJoin(competitions, eq(competitionTeams.competitionId, competitions.id))
    .leftJoin(championships, eq(competitions.championshipId, championships.id))
    .where(and(eq(competitionTeams.clubId, clubId), ne(competitions.status, "DRAFT")))
    .orderBy(desc(competitions.season), asc(competitions.name));
}

/** Engagements d'une saison donnée, pour plusieurs compétitions (préparation de la saison suivante). */
export async function outcomesOf(competitionIds: number[]) {
  if (competitionIds.length === 0) return [];
  return db
    .select({ competitionId: competitionTeams.competitionId, clubId: competitionTeams.clubId, outcome: competitionTeams.outcome })
    .from(competitionTeams)
    .where(inArray(competitionTeams.competitionId, competitionIds));
}
