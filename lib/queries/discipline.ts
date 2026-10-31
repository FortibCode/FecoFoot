import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, ne, or } from "drizzle-orm";
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

/** Décisions publiées de la commission (portail), filtrées par type de sanction et par texte cherché. */
export async function publishedDecisions(filters: { sanction?: SanctionType; search?: string } = {}) {
  const rows = await db
    .select({
      c: disciplineCases,
      lastName: players.lastName,
      firstName: players.firstName,
      clubId: clubs.id,
      club: clubs.name,
      competition: competitions.name,
    })
    .from(disciplineCases)
    .leftJoin(players, eq(disciplineCases.playerId, players.id))
    .leftJoin(clubs, eq(disciplineCases.clubId, clubs.id))
    .leftJoin(competitions, eq(disciplineCases.competitionId, competitions.id))
    .where(and(eq(disciplineCases.status, "DECIDED"), isNotNull(disciplineCases.publishedAt)))
    .orderBy(desc(disciplineCases.decidedAt))
    .limit(300);
  // Comptes par type de sanction : sur toutes les décisions publiées (les puces de filtre).
  const counts = new Map<SanctionType, number>();
  for (const r of rows) if (r.c.sanctionType) counts.set(r.c.sanctionType, (counts.get(r.c.sanctionType) ?? 0) + 1);
  const q = filters.search?.trim().toLowerCase();
  const list = rows.filter(
    (r) =>
      (!filters.sanction || r.c.sanctionType === filters.sanction) &&
      (!q || [r.c.number, r.lastName, r.firstName, r.club, r.competition].some((v) => v?.toLowerCase().includes(q))),
  );
  return { list, total: rows.length, counts };
}

/**
 * Suspensions en cours, publiques : automatiques (cartons, compétitions publiées) et prononcées par la commission
 * (décisions publiées), avec le nombre de matchs restant à purger quand il est connu.
 */
export async function currentSuspensions() {
  const comps = await db.select({ id: competitions.id, name: competitions.name }).from(competitions).where(ne(competitions.status, "DRAFT"));
  const auto = (
    await Promise.all(
      comps.map(async (c) =>
        (await competitionSuspensions(c.id))
          .filter((s) => s.active)
          .map((s) => ({
            key: `auto-${c.id}-${s.playerId}-${s.fromMatchId}`,
            name: s.player ? `${s.player.firstName} ${s.player.lastName}` : "Joueur",
            club: s.player?.club ?? null,
            clubId: s.clubId,
            competition: c.name,
            reason: s.reason,
            caseNumber: null as string | null,
            remaining: Math.max(0, s.matches - s.servedInMatchIds.length) as number | null,
            until: null as Date | null,
          })),
      ),
    )
  ).flat();
  const decided = (await activeCaseSuspensions())
    .filter((s) => s.c.publishedAt)
    .map((s) => ({
      key: `case-${s.c.id}`,
      name: `${s.firstName} ${s.lastName}`,
      club: s.club,
      clubId: s.clubId,
      competition: null as string | null,
      reason: null,
      caseNumber: s.c.number,
      remaining: s.c.sanctionType === "MATCH_SUSPENSION" ? Math.max(0, (s.c.suspensionMatches ?? 0) - s.played) : null,
      until: s.c.sanctionType === "TIME_SUSPENSION" ? s.c.suspensionUntil : null,
    }));
  return [...decided, ...auto];
}
