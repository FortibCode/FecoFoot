import "server-only";
import { and, asc, eq, gt, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, competitions, disciplineCases, matchEvents, matches, players } from "@/lib/db/schema";
import { autoSuspensions, caseSuspensionActive, type AutoSuspension, type SanctionType } from "@/lib/discipline";

/** Suspensions automatiques d'une compétition (cumul de cartons), avec noms des joueurs et clubs. */
export async function competitionSuspensions(competitionId: number) {
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!competition) return [];
  const rows = await db.select().from(matches).where(eq(matches.competitionId, competitionId));
  const events = rows.length
    ? await db
        .select({ matchId: matchEvents.matchId, playerId: matchEvents.playerId, clubId: matchEvents.clubId, type: matchEvents.type })
        .from(matchEvents)
        .where(inArray(matchEvents.matchId, rows.map((m) => m.id)))
    : [];
  const list = autoSuspensions(
    rows.map((m) => ({ ...m, events: events.filter((e) => e.matchId === m.id) })),
    competition.yellowCardThreshold,
  );
  return withNames(list);
}

async function withNames(list: AutoSuspension[]) {
  if (list.length === 0) return [];
  const people = await db
    .select({ id: players.id, lastName: players.lastName, firstName: players.firstName, club: clubs.name })
    .from(players)
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(inArray(players.id, [...new Set(list.map((s) => s.playerId))]));
  const byId = new Map(people.map((p) => [p.id, p]));
  return list.map((s) => ({ ...s, player: byId.get(s.playerId) }));
}

/** Matchs terminés d'un club depuis une date (dans une compétition, ou toutes compétitions). */
async function clubMatchesSince(clubId: number, since: Date, competitionId: number | null) {
  return db.$count(
    matches,
    and(
      eq(matches.status, "FINISHED"),
      gt(matches.kickoffAt, since),
      or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId)),
      competitionId ? eq(matches.competitionId, competitionId) : undefined,
    ),
  );
}

/** Suspensions prononcées par la commission encore en cours. */
export async function activeCaseSuspensions() {
  const decided = await db
    .select({ c: disciplineCases, lastName: players.lastName, firstName: players.firstName, clubId: players.clubId, club: clubs.name })
    .from(disciplineCases)
    .innerJoin(players, eq(disciplineCases.playerId, players.id))
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(and(eq(disciplineCases.status, "DECIDED"), inArray(disciplineCases.sanctionType, ["MATCH_SUSPENSION", "TIME_SUSPENSION"]), isNotNull(disciplineCases.decidedAt)))
    .orderBy(asc(disciplineCases.decidedAt));
  const active = [];
  for (const row of decided) {
    const played = row.clubId ? await clubMatchesSince(row.clubId, row.c.decidedAt!, row.c.competitionId) : 0;
    if (caseSuspensionActive({ type: row.c.sanctionType as SanctionType, suspensionMatches: row.c.suspensionMatches, suspensionUntil: row.c.suspensionUntil }, played)) {
      active.push({ ...row, played });
    }
  }
  return active;
}

/**
 * Joueurs d'un club suspendus pour un match d'une compétition : suspensions automatiques de la compétition
 * et sanctions de la commission (valables dans la compétition visée, ou partout si aucune n'est précisée).
 */
export async function suspendedPlayers(clubId: number, competitionId: number): Promise<Map<number, string>> {
  const suspended = new Map<number, string>();
  for (const s of await competitionSuspensions(competitionId)) {
    if (s.active && s.clubId === clubId) suspended.set(s.playerId, "suspension automatique (cartons)");
  }
  for (const s of await activeCaseSuspensions()) {
    if (s.clubId === clubId && (!s.c.competitionId || s.c.competitionId === competitionId)) suspended.set(s.c.playerId!, `décision ${s.c.number}`);
  }
  return suspended;
}
