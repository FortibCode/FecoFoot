import "server-only";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CurrentUser } from "@/lib/auth/guard";
import { can, canAccessCompetition } from "@/lib/auth/roles";
import { GOAL_EVENTS, hasScore, knockoutWinner, nextSlot, parseTiebreakers, scoreFromEvents, standings, topScorers } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitions, competitionTeams, leagues, licenses, matchEvents, matches, matchOfficials, players, referees } from "@/lib/db/schema";

export const homeClub = alias(clubs, "home_club");
export const awayClub = alias(clubs, "away_club");

/** Matchs avec les noms des équipes (null : équipe à déterminer ou exempt). */
export function matchQuery() {
  return db
    .select({
      match: matches,
      competition: {
        id: competitions.id,
        name: competitions.name,
        slug: competitions.slug,
        type: competitions.type,
        season: competitions.season,
        status: competitions.status,
        leagueId: competitions.leagueId,
      },
      home: { id: homeClub.id, name: homeClub.name, shortName: homeClub.shortName },
      away: { id: awayClub.id, name: awayClub.name, shortName: awayClub.shortName },
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
    .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id));
}

export type MatchRow = Awaited<ReturnType<ReturnType<typeof matchQuery>["execute"]>>[number];

/** Compétition accessible à l'utilisateur (périmètre ligue), sinon null. */
export async function competitionFor(user: CurrentUser, competitionId: number) {
  if (!Number.isInteger(competitionId)) return null;
  const [c] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  return c && canAccessCompetition(user, c) ? c : null;
}

/** Ligue organisatrice d'une compétition (null : nationale). */
export async function competitionLeague(leagueId: number | null) {
  if (leagueId === null) return null;
  const [l] = await db.select({ id: leagues.id, code: leagues.code, name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  return l ?? null;
}

/**
 * Classement et meilleurs buteurs d'une compétition (EF-CMP-06), par poule le cas échéant.
 * Seuls les résultats officiels (terminés et validés) comptent ; une correction ou une annulation
 * est donc prise en compte au calcul suivant, sans table de classement à maintenir.
 */
export async function competitionTables(competitionId: number) {
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!competition) return null;
  const teams = await db
    .select({ clubId: competitionTeams.clubId, pool: competitionTeams.pool, penalty: competitionTeams.pointsPenalty, name: clubs.name, shortName: clubs.shortName })
    .from(competitionTeams)
    .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
    .where(eq(competitionTeams.competitionId, competitionId));
  const finished = await db
    .select()
    .from(matches)
    .where(and(eq(matches.competitionId, competitionId), eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt)));
  const names = new Map(teams.map((t) => [t.clubId, t]));

  const pools = [...new Set(teams.map((t) => t.pool ?? ""))].sort();
  const tables = pools.map((pool) => {
    const poolTeams = teams.filter((t) => (t.pool ?? "") === pool);
    const rows = standings(
      poolTeams.map((t) => t.clubId),
      finished
        .filter((m) => m.homeClubId !== null && m.awayClubId !== null && m.homeScore !== null && m.awayScore !== null)
        .map((m) => ({ homeClubId: m.homeClubId!, awayClubId: m.awayClubId!, homeScore: m.homeScore!, awayScore: m.awayScore!, kickoffAt: m.kickoffAt })),
      { win: competition.pointsWin, draw: competition.pointsDraw, loss: competition.pointsLoss },
      new Map(poolTeams.map((t) => [t.clubId, t.penalty])),
      parseTiebreakers(competition.tiebreakers),
    );
    return { pool, rows: rows.map((r) => ({ ...r, name: names.get(r.clubId)?.name ?? "?", shortName: names.get(r.clubId)?.shortName ?? null })) };
  });

  const events = await db
    .select({ type: matchEvents.type, playerId: matchEvents.playerId })
    .from(matchEvents)
    .innerJoin(matches, eq(matchEvents.matchId, matches.id))
    .where(and(eq(matches.competitionId, competitionId), isNotNull(matches.validatedAt)));
  const scorers = topScorers(events).slice(0, 20);
  const scorerRows = scorers.length
    ? await db
        .select({ id: players.id, lastName: players.lastName, firstName: players.firstName, club: clubs.name })
        .from(players)
        .leftJoin(clubs, eq(players.clubId, clubs.id))
        .where(inArray(players.id, scorers.map((s) => s.playerId)))
    : [];
  const byId = new Map(scorerRows.map((p) => [p.id, p]));
  return {
    competition,
    tables,
    scorers: scorers.map((s) => ({ ...s, player: byId.get(s.playerId) })),
  };
}

/**
 * Recalcule le score d'un match à partir de ses buts (RG-07) et, pour une coupe terminée,
 * place le vainqueur dans le match du tour suivant (EF-CMP-08).
 * Sans aucun but saisi, le score saisi directement sur la feuille (buteurs inconnus) est conservé.
 */
export async function recomputeMatch(matchId: number) {
  const [m] = await db
    .select({ match: matches, type: competitions.type })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!m?.match.homeClubId || !m.match.awayClubId) return;
  const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, matchId));
  const goals = events.filter((e) => GOAL_EVENTS.includes(e.type));
  let score: { home: number | null; away: number | null };
  if (!hasScore(m.match.status)) score = { home: null, away: null };
  else if (goals.length > 0) score = scoreFromEvents(events, m.match.homeClubId, m.match.awayClubId);
  else score = { home: m.match.homeScore ?? 0, away: m.match.awayScore ?? 0 };
  await db.update(matches).set({ homeScore: score.home, awayScore: score.away }).where(eq(matches.id, matchId));
  if (m.type === "CUP") await advanceWinner(matchId);
}

/** Qualifie le vainqueur d'un match de coupe terminé (ou d'une exemption) pour le tour suivant. */
export async function advanceWinner(matchId: number) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m || m.bracketSlot === null) return;
  const isBye = m.homeClubId !== null && m.awayClubId === null;
  const winner = isBye || m.status === "FINISHED" ? knockoutWinner(m) : null;
  const next = nextSlot(m.round, m.bracketSlot);
  await db
    .update(matches)
    .set(next.side === "home" ? { homeClubId: winner } : { awayClubId: winner })
    .where(and(eq(matches.competitionId, m.competitionId), eq(matches.round, next.round), eq(matches.bracketSlot, next.slot)));
}

/** Arbitre lié au compte connecté (profil Arbitre / commissaire). */
export async function refereeOf(user: CurrentUser) {
  if (user.role !== "REFEREE") return null;
  const [ref] = await db.select().from(referees).where(eq(referees.userId, user.id)).limit(1);
  return ref ?? null;
}

/**
 * Feuille de match : la fédération, ou le commissaire désigné sur ce match,
 * depuis son téléphone au stade (EF-CMP-09).
 */
export async function canEditMatchSheet(user: CurrentUser, matchId: number): Promise<boolean> {
  if (can(user.role, "competitions.manage")) return canManageMatch(user, matchId);
  const ref = await refereeOf(user);
  if (!ref) return false;
  const [d] = await db
    .select({ id: matchOfficials.id })
    .from(matchOfficials)
    .where(and(eq(matchOfficials.matchId, matchId), eq(matchOfficials.refereeId, ref.id), eq(matchOfficials.role, "COMMISSIONER")))
    .limit(1);
  return Boolean(d);
}

/** Gestion d'un match (programmation, validation) : selon le périmètre de sa compétition. */
export async function canManageMatch(user: CurrentUser, matchId: number): Promise<boolean> {
  if (!can(user.role, "competitions.manage")) return false;
  const [m] = await db
    .select({ leagueId: competitions.leagueId })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  return Boolean(m) && canAccessCompetition(user, m);
}

export async function competitionTeamOptions(competitionId: number) {
  return db
    .select({ id: clubs.id, name: clubs.name })
    .from(competitionTeams)
    .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
    .where(eq(competitionTeams.competitionId, competitionId))
    .orderBy(asc(clubs.name));
}

/** Joueurs du club titulaires d'une licence validée pour la saison de la compétition. */
export async function eligiblePlayers(clubId: number, season: number) {
  return db
    .select({ id: players.id, lastName: players.lastName, firstName: players.firstName, position: players.position })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .where(and(eq(licenses.clubId, clubId), eq(licenses.season, season), eq(licenses.status, "VALIDATED"), eq(players.clubId, clubId)));
}
