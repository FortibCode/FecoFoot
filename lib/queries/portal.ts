import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, clubs, competitions, competitionTeams, licenses, matches, nationalTeams, selections, ticketEvents } from "@/lib/db/schema";
import { seasonOf } from "@/lib/licenses";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

/** Données de la page d'accueil du portail (EF-PUB-01). */
export async function homeData() {
  const now = new Date();
  const season = seasonOf();
  const [results, upcoming, onSale, news, latestSelection, [{ clubsCount }], [{ licensesCount }], main] = await Promise.all([
    // Résultats officiels uniquement (validés par l'organisateur).
    matchQuery().where(and(eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt))).orderBy(desc(matches.kickoffAt)).limit(6),
    matchQuery()
      .where(and(eq(matches.status, "SCHEDULED"), gte(matches.kickoffAt, now), isNotNull(matches.homeClubId), isNotNull(matches.awayClubId)))
      .orderBy(asc(matches.kickoffAt))
      .limit(6),
    db
      .select()
      .from(ticketEvents)
      .where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN"]), gt(ticketEvents.kickoffAt, now)))
      .orderBy(asc(ticketEvents.kickoffAt))
      .limit(3),
    db.select().from(articles).where(eq(articles.status, "PUBLISHED")).orderBy(desc(articles.publishedAt), desc(articles.id)).limit(9),
    db
      .select({ s: selections, team: nationalTeams })
      .from(selections)
      .innerJoin(nationalTeams, eq(selections.teamId, nationalTeams.id))
      .where(eq(selections.status, "PUBLISHED"))
      .orderBy(desc(selections.publishedAt))
      .limit(1),
    db.select({ clubsCount: count() }).from(clubs).where(eq(clubs.status, "AFFILIATED")),
    db.select({ licensesCount: count() }).from(licenses).where(and(eq(licenses.season, season), eq(licenses.status, "VALIDATED"))),
    // Championnat mis en avant : le championnat national senior masculin en cours qui compte le plus d'équipes.
    db
      .select({ id: competitions.id, n: count(competitionTeams.id) })
      .from(competitions)
      .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
      .where(
        and(
          eq(competitions.type, "LEAGUE"),
          isNull(competitions.leagueId),
          or(eq(competitions.status, "ONGOING"), eq(competitions.status, "FINISHED")),
          eq(competitions.category, "SENIOR"),
          eq(competitions.gender, "M"),
        ),
      )
      .groupBy(competitions.id)
      .orderBy(desc(competitions.season), desc(count(competitionTeams.id)))
      .limit(1),
  ]);
  const table = main[0] ? await competitionTables(main[0].id) : null;
  return { results, upcoming, onSale, news, latestSelection: latestSelection[0] ?? null, clubsCount, licensesCount, table };
}

/**
 * Clubs du championnat d'élite (Ligue 1 National) : le championnat national senior masculin le plus récent, brouillon compris
 * (les clubs engagés sont connus avant la publication du calendrier).
 */
export async function eliteClubs() {
  const [comp] = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug, season: competitions.season, status: competitions.status })
    .from(competitions)
    .where(and(eq(competitions.type, "LEAGUE"), isNull(competitions.leagueId), eq(competitions.category, "SENIOR"), eq(competitions.gender, "M")))
    // À saison égale, la première division (« Ligue 1 ») avant la deuxième.
    .orderBy(desc(competitions.season), asc(competitions.name), desc(competitions.id))
    .limit(1);
  if (!comp) return null;
  const teams = await db
    .select({ id: clubs.id, name: clubs.name, shortName: clubs.shortName, slug: clubs.slug, city: clubs.city })
    .from(competitionTeams)
    .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
    .where(and(eq(competitionTeams.competitionId, comp.id), eq(clubs.status, "AFFILIATED")))
    .orderBy(asc(clubs.name));
  return teams.length ? { competition: comp, teams } : null;
}
