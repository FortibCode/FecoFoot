import "server-only";
import { and, asc, desc, eq, ilike, lt, ne } from "drizzle-orm";
import type { FormItem } from "@/components/matches/form-rows";
import { groupTable, recordTotals, streaks, type MatchStatValues } from "@/lib/competitions";
import { playerPhotoUrls } from "@/lib/queries/player-photos";
import { flagUrl } from "@/lib/flags";
import { db } from "@/lib/db";
import { clubs, matchStats, nationalEvents, nationalLineups, intlCompetitions, intlGroupMatches, intlGroups, intlGroupTeams, nationalFixtures, nationalStaff, nationalTeams, players, selectionPlayers, selections } from "@/lib/db/schema";

/** Liste de convoqués avec le club (national ou étranger) de chaque joueur. */
export async function calledPlayers(selectionId: number) {
  const rows = await db
    .select({
      entry: selectionPlayers,
      lastName: players.lastName,
      firstName: players.firstName,
      federalId: players.federalId,
      clubId: clubs.id,
      club: clubs.name,
      clubEmail: clubs.email,
    })
    .from(selectionPlayers)
    .leftJoin(players, eq(selectionPlayers.playerId, players.id))
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(selectionPlayers.selectionId, selectionId))
    .orderBy(asc(selectionPlayers.position), asc(selectionPlayers.shirtNumber), asc(selectionPlayers.id));
  return rows.map((r) => ({
    id: r.entry.id,
    name: r.entry.playerId ? `${r.firstName} ${r.lastName}` : (r.entry.externalName ?? ""),
    federalId: r.federalId,
    // Joueur hors registre : club seul s'il évolue au Congo, « club (pays) » sinon.
    club: r.entry.playerId
      ? (r.club ?? "—")
      : !r.entry.externalCountry || r.entry.externalCountry === "Congo"
        ? (r.entry.externalClub ?? "—")
        : `${r.entry.externalClub} (${r.entry.externalCountry})`,
    // Club national à qui adresser la lettre de convocation (EF-SEL-05) ; null pour un joueur de l'étranger.
    homeClub: r.entry.playerId && r.clubId ? { id: r.clubId, name: r.club ?? "", email: r.clubEmail } : null,
    abroad: !r.entry.playerId,
    position: r.entry.position,
    shirtNumber: r.entry.shirtNumber,
    playerId: r.entry.playerId,
  }));
}

export async function teamPage(code: string, { publishedOnly }: { publishedOnly: boolean }) {
  const [team] = await db
    .select()
    .from(nationalTeams)
    .where(eq(nationalTeams.code, code as (typeof nationalTeams.$inferSelect)["code"]))
    .limit(1);
  if (!team) return null;
  const [staff, fixtures, lists] = await Promise.all([
    db.select().from(nationalStaff).where(eq(nationalStaff.teamId, team.id)).orderBy(asc(nationalStaff.sortOrder), asc(nationalStaff.id)),
    db.select().from(nationalFixtures).where(eq(nationalFixtures.teamId, team.id)).orderBy(desc(nationalFixtures.kickoffAt)),
    db.select().from(selections).where(eq(selections.teamId, team.id)).orderBy(desc(selections.createdAt)),
  ]);
  return { team, staff, fixtures, selections: publishedOnly ? lists.filter((s) => s.status === "PUBLISHED") : lists };
}

// ─── Fiche d'un match des sélections ─────────────────────────────────────────

type Fixture = typeof nationalFixtures.$inferSelect;
const congo = { name: "Congo", flag: flagUrl("Congo") };
const sideOf = (f: Fixture) => {
  const opponent = { name: f.opponent, flag: flagUrl(f.opponent) };
  return f.isHome ? [congo, opponent] : [opponent, congo];
};
/** Score dans l'ordre domicile – extérieur. */
export const fixtureScore = (f: Fixture): [number, number] | null =>
  f.goalsFor === null || f.goalsAgainst === null ? null : f.isHome ? [f.goalsFor, f.goalsAgainst] : [f.goalsAgainst, f.goalsFor];

/** Un match des sélections, avec sa sélection. */
export async function nationalFixture(id: number) {
  if (!Number.isInteger(id)) return null;
  const [row] = await db
    .select({ f: nationalFixtures, team: { id: nationalTeams.id, name: nationalTeams.name, slug: nationalTeams.slug } })
    .from(nationalFixtures)
    .innerJoin(nationalTeams, eq(nationalFixtures.teamId, nationalTeams.id))
    .where(eq(nationalFixtures.id, id))
    .limit(1);
  return row ? { ...row, sides: sideOf(row.f) } : null;
}

const toForm = (f: Fixture): FormItem => {
  const [home, away] = sideOf(f);
  const goalsFor = f.goalsFor ?? 0;
  const goalsAgainst = f.goalsAgainst ?? 0;
  return {
    id: f.id,
    href: `/matchs/selection/${f.id}`,
    date: f.kickoffAt,
    home: { name: home.name, flag: home.flag },
    away: { name: away.name, flag: away.flag },
    score: fixtureScore(f) ?? [0, 0],
    result: goalsFor > goalsAgainst ? "V" : goalsFor === goalsAgainst ? "N" : "D",
  };
};

/** Forme d'une sélection avant un match : 5 derniers résultats, bilan des 10 derniers, séries. */
export async function nationalRecord(teamId: number, before: Date, excludeId: number) {
  const rows = await db
    .select()
    .from(nationalFixtures)
    .where(and(eq(nationalFixtures.teamId, teamId), eq(nationalFixtures.status, "PLAYED"), lt(nationalFixtures.kickoffAt, before), ne(nationalFixtures.id, excludeId)))
    .orderBy(desc(nationalFixtures.kickoffAt))
    .limit(30);
  const items = rows.map(toForm);
  return {
    recent: items.slice(0, 5),
    totals: recordTotals(rows.slice(0, 10).map((f) => ({ goalsFor: f.goalsFor ?? 0, goalsAgainst: f.goalsAgainst ?? 0 }))),
    streaks: streaks(items.map((i) => i.result)),
  };
}

/** Face-à-face : matchs joués par cette sélection contre le même adversaire. */
export async function nationalHeadToHead(teamId: number, opponent: string, excludeId: number) {
  const rows = await db
    .select()
    .from(nationalFixtures)
    .where(and(eq(nationalFixtures.teamId, teamId), eq(nationalFixtures.status, "PLAYED"), ilike(nationalFixtures.opponent, opponent), ne(nationalFixtures.id, excludeId)))
    .orderBy(desc(nationalFixtures.kickoffAt));
  return { items: rows.map(toForm), totals: recordTotals(rows.map((f) => ({ goalsFor: f.goalsFor ?? 0, goalsAgainst: f.goalsAgainst ?? 0 }))) };
}

/** Calendrier complet d'une sélection (pour l'onglet « Calendrier »). */
export async function nationalCalendar(teamId: number) {
  return db.select().from(nationalFixtures).where(eq(nationalFixtures.teamId, teamId)).orderBy(asc(nationalFixtures.kickoffAt));
}

/** Liste de convoqués publiée la plus récente avant le match (ou la dernière publiée pour un match à venir). */
export async function selectionForFixture(teamId: number, kickoffAt: Date) {
  const [s] = await db
    .select()
    .from(selections)
    .where(and(eq(selections.teamId, teamId), eq(selections.status, "PUBLISHED"), lt(selections.publishedAt, kickoffAt)))
    .orderBy(desc(selections.publishedAt))
    .limit(1);
  return s ? { selection: s, players: await calledPlayers(s.id) } : null;
}

// ─── Groupes des compétitions internationales ────────────────────────────────

/** Une rencontre du groupe : match du Congo (fiche) ou entre deux autres pays. */
export type GroupFixture = {
  key: string;
  matchday: number;
  home: { name: string; flag: string | null };
  away: { name: string; flag: string | null };
  date: Date | null;
  venue: string | null;
  status: "SCHEDULED" | "PLAYED" | "CANCELLED";
  score: [number, number] | null;
  href: string | null;
};

/** Groupe complet : compétition, pays, rencontres par journée, classements total / domicile / extérieur. */
export async function groupDetail(groupId: number) {
  const [row] = await db
    .select({ g: intlGroups, competition: intlCompetitions })
    .from(intlGroups)
    .innerJoin(intlCompetitions, eq(intlGroups.competitionId, intlCompetitions.id))
    .where(eq(intlGroups.id, groupId))
    .limit(1);
  if (!row) return null;
  const [teams, congo, others] = await Promise.all([
    db.select().from(intlGroupTeams).where(eq(intlGroupTeams.groupId, groupId)).orderBy(asc(intlGroupTeams.country)),
    db.select().from(nationalFixtures).where(eq(nationalFixtures.groupId, groupId)),
    db.select().from(intlGroupMatches).where(eq(intlGroupMatches.groupId, groupId)),
  ]);
  const side = (name: string) => ({ name, flag: flagUrl(name) });
  const fixtures: GroupFixture[] = [
    ...congo.map((f) => {
      const [home, away] = sideOf(f);
      return {
        key: `n${f.id}`,
        matchday: f.matchday ?? 0,
        home: { name: home.name, flag: home.flag },
        away: { name: away.name, flag: away.flag },
        date: f.kickoffAt,
        venue: f.venue,
        status: f.status,
        score: f.status === "PLAYED" ? fixtureScore(f) : null,
        href: `/matchs/selection/${f.id}`,
      };
    }),
    ...others.map((m) => ({
      key: `g${m.id}`,
      matchday: m.matchday,
      home: side(m.home),
      away: side(m.away),
      date: m.kickoffAt,
      venue: m.venue,
      status: m.status,
      score: m.status === "PLAYED" && m.homeGoals !== null && m.awayGoals !== null ? ([m.homeGoals, m.awayGoals] as [number, number]) : null,
      href: null,
    })),
  ].sort((a, b) => a.matchday - b.matchday || (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  const results = fixtures.filter((f) => f.score).map((f) => ({ home: f.home.name, away: f.away.name, homeGoals: f.score![0], awayGoals: f.score![1], date: f.date }));
  const names = teams.map((t) => t.country);
  // Rencontres attendues en aller-retour : n × (n − 1) ; sert à signaler un classement provisoire.
  const expected = names.length * (names.length - 1);
  return {
    group: row.g,
    competition: row.competition,
    teams: names,
    fixtures,
    played: results.length,
    expected,
    tables: { all: groupTable(names, results, "all"), home: groupTable(names, results, "home"), away: groupTable(names, results, "away") },
  };
}

/** Groupes d'une sélection (administration) avec leurs pays et les matchs entre les autres pays. */
export async function teamGroups(teamId: number) {
  const groups = await db
    .select({ g: intlGroups, competition: intlCompetitions })
    .from(intlGroups)
    .innerJoin(intlCompetitions, eq(intlGroups.competitionId, intlCompetitions.id))
    .where(eq(intlGroups.teamId, teamId))
    .orderBy(desc(intlCompetitions.season), asc(intlGroups.name));
  return Promise.all(
    groups.map(async ({ g, competition }) => ({
      group: g,
      competition,
      teams: (await db.select().from(intlGroupTeams).where(eq(intlGroupTeams.groupId, g.id)).orderBy(asc(intlGroupTeams.country))).map((t) => t.country),
      matches: await db.select().from(intlGroupMatches).where(eq(intlGroupMatches.groupId, g.id)).orderBy(asc(intlGroupMatches.matchday), asc(intlGroupMatches.kickoffAt)),
    })),
  );
}

/** Feuille publique d'un match des sélections : composition (si publiée, photos autorisées), événements, statistiques. */
export async function fixtureSheet(fixtureId: number, lineupPublished: boolean) {
  const [lineup, events, stats] = await Promise.all([
    lineupPublished ? db.select().from(nationalLineups).where(eq(nationalLineups.fixtureId, fixtureId)).orderBy(asc(nationalLineups.shirtNumber)) : Promise.resolve([]),
    db.select().from(nationalEvents).where(eq(nationalEvents.fixtureId, fixtureId)).orderBy(asc(nationalEvents.minute), asc(nationalEvents.id)),
    db.select().from(matchStats).where(eq(matchStats.fixtureId, fixtureId)),
  ]);
  const photos = await playerPhotoUrls(lineup.map((l) => l.playerId).filter((id): id is number => id !== null), { publicOnly: true });
  return {
    lineup: lineup.map((l) => {
      const [first, ...rest] = l.name.split(" ");
      return { id: l.id, number: l.shirtNumber, firstName: rest.length ? first : "", lastName: rest.length ? rest.join(" ") : l.name, position: l.position, starter: l.starter, captain: l.captain, photo: l.playerId ? (photos.get(l.playerId) ?? null) : null };
    }),
    events,
    stats: Object.fromEntries(stats.map(({ period, ...v }) => [period, v as unknown as MatchStatValues])) as Partial<Record<"ALL" | "H1" | "H2", MatchStatValues>>,
  };
}
