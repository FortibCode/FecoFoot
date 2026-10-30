import "server-only";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, championships, clubs, competitions, competitionTeams, leagues, licenses } from "@/lib/db/schema";
import { seasonOf } from "@/lib/licenses";

/** Données de la page d'accueil du portail (EF-PUB-01). */
export async function homeData() {
  const season = seasonOf();
  // Les matchs de l'accueil viennent de la section « Matchs et résultats » (lib/queries/matches.ts).
  const [news, [{ clubsCount }], [{ licensesCount }], [{ leaguesCount }]] = await Promise.all([
    db.select().from(articles).where(eq(articles.status, "PUBLISHED")).orderBy(desc(articles.publishedAt), desc(articles.id)).limit(9),
    db.select({ clubsCount: count() }).from(clubs).where(eq(clubs.status, "AFFILIATED")),
    db.select({ licensesCount: count() }).from(licenses).where(and(eq(licenses.season, season), eq(licenses.status, "VALIDATED"))),
    db.select({ leaguesCount: count() }).from(leagues).where(eq(leagues.active, true)),
  ]);
  return { news, clubsCount, licensesCount, leaguesCount };
}

/**
 * Clubs du championnat d'élite (Ligue 1 National) : le championnat national senior masculin le plus récent, brouillon compris
 * (les clubs engagés sont connus avant la publication du calendrier).
 */
export async function eliteClubs() {
  const [comp] = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      season: competitions.season,
      status: competitions.status,
      type: competitions.type,
      doubleRound: competitions.doubleRound,
      // Championnat national de rattachement : sa page publique et son logo officiel.
      championship: { id: championships.id, code: championships.code, logoKey: championships.logoKey },
    })
    .from(competitions)
    .leftJoin(championships, eq(competitions.championshipId, championships.id))
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
