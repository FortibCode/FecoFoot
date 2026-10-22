import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, competitions, competitionTeams, leagues, matches } from "@/lib/db/schema";
import { matchQuery } from "@/lib/queries/competitions";

/**
 * Portail : ligues départementales actives, avec leurs clubs affiliés, leurs compétitions publiées
 * (en cours) et la saison la plus récente. Les compétitions en préparation ne sont jamais montrées.
 */
export async function leaguesOverview() {
  return db
    .select({
      id: leagues.id,
      code: leagues.code,
      name: leagues.name,
      department: leagues.department,
      logoKey: leagues.logoKey,
      clubs: sql<number>`(select count(*)::int from ${clubs} where ${clubs.leagueId} = ${leagues.id} and ${clubs.status} = 'AFFILIATED')`,
      ongoing: sql<number>`(select count(*)::int from ${competitions} where ${competitions.leagueId} = ${leagues.id} and ${competitions.status} = 'ONGOING')`,
      season: sql<number | null>`(select max(${competitions.season}) from ${competitions} where ${competitions.leagueId} = ${leagues.id} and ${competitions.status} <> 'DRAFT')`,
    })
    .from(leagues)
    .where(eq(leagues.active, true))
    .orderBy(asc(leagues.name));
}

/** Divisions nationales publiées (championnats organisés par la fédération). */
export async function nationalDivisions() {
  return db
    .select({ c: competitions, teams: count(competitionTeams.id) })
    .from(competitions)
    .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
    .where(and(isNull(competitions.leagueId), eq(competitions.type, "LEAGUE"), ne(competitions.status, "DRAFT")))
    .groupBy(competitions.id)
    .orderBy(desc(competitions.season), asc(competitions.name));
}

/** Fiche publique d'une ligue active (par son code, insensible à la casse). */
export async function leagueDetail(code: string) {
  const [league] = await db
    .select()
    .from(leagues)
    .where(and(eq(sql`lower(${leagues.code})`, code.toLowerCase()), eq(leagues.active, true)))
    .limit(1);
  if (!league) return null;
  const [clubRows, comps] = await Promise.all([
    db
      .select({ id: clubs.id, name: clubs.name, slug: clubs.slug, city: clubs.city })
      .from(clubs)
      .where(and(eq(clubs.leagueId, league.id), eq(clubs.status, "AFFILIATED")))
      .orderBy(asc(clubs.name)),
    db
      .select()
      .from(competitions)
      .where(and(eq(competitions.leagueId, league.id), ne(competitions.status, "DRAFT")))
      .orderBy(desc(competitions.season), asc(competitions.name)),
  ]);
  const ids = comps.map((c) => c.id);
  const [upcoming, results] = ids.length
    ? await Promise.all([
        matchQuery()
          .where(
            and(
              inArray(matches.competitionId, ids),
              inArray(matches.status, ["SCHEDULED", "LIVE", "HALF_TIME", "POSTPONED"]),
              sql`${matches.kickoffAt} >= now() - interval '3 hours'`,
              isNotNull(matches.homeClubId),
              isNotNull(matches.awayClubId),
            ),
          )
          .orderBy(asc(matches.kickoffAt))
          .limit(6),
        matchQuery()
          .where(and(inArray(matches.competitionId, ids), eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt)))
          .orderBy(desc(matches.kickoffAt))
          .limit(6),
      ])
    : [[], []];
  return { league, clubs: clubRows, competitions: comps, upcoming, results };
}
