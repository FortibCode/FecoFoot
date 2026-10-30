import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  max,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { FixtureItem } from "@/components/matches/match-card";
import { db } from "@/lib/db";
import {
  leagues,
  championships,
  competitions,
  competitionTeams,
  clubs,
  matches,
  matchEvents,
  nationalFixtures,
  nationalTeams,
  players,
  ticketEvents,
} from "@/lib/db/schema";
import {
  competitionFamily,
  goalBuckets,
  streaks,
  MATCH_FAMILIES,
  MATCH_FAMILY_LABELS,
  MATCH_STATUSES_OF,
  publicMatchStatus,
  roundLabel,
  type MatchFamily,
  type MatchPeriod,
  type PublicMatchStatus,
} from "@/lib/competitions";
import { flagUrl } from "@/lib/flags";
import { matchQuery, type MatchRow } from "@/lib/queries/competitions";
import { suspendedPlayers } from "@/lib/queries/discipline";

export type MatchFilters = {
  /** Compétition (identifiant) ou « selections » : matchs des équipes nationales. */
  competition?: number | "selections";
  season?: number;
  club?: number;
  status?: PublicMatchStatus;
  /** Jour AAAA-MM-JJ (heure de Brazzaville). */
  date?: string;
  /** Catégorie (Ligue 1, coupes, jeunes…) : ses compétitions, résolues par `withFamily`. */
  family?: MatchFamily;
  competitionIds?: number[];
};

/** Compétitions publiées de chaque catégorie (d'après leur configuration et le niveau du championnat). */
export async function competitionFamilies() {
  const rows = await db
    .select({
      id: competitions.id,
      gender: competitions.gender,
      category: competitions.category,
      leagueId: competitions.leagueId,
      type: competitions.type,
      tier: championships.tier,
      championship: championships.name,
    })
    .from(competitions)
    .leftJoin(championships, eq(competitions.championshipId, championships.id))
    .where(ne(competitions.status, "DRAFT"));
  const ids = new Map<MatchFamily, number[]>();
  const names = new Map<MatchFamily, string>();
  for (const r of rows) {
    const fam = competitionFamily(r);
    ids.set(fam, [...(ids.get(fam) ?? []), r.id]);
    // Divisions nationales : leur nom officiel (« Direct Ligue 1 »).
    if ((fam === "ligue-1" || fam === "ligue-2") && r.championship)
      names.set(fam, r.championship);
  }
  return { ids, names };
}

/** Filtres complétés par les compétitions de la catégorie choisie. */
export async function withFamily(f: MatchFilters): Promise<MatchFilters> {
  if (!f.family) return f;
  if (f.family === "selections") return { ...f, competition: "selections" };
  const { ids } = await competitionFamilies();
  return { ...f, competitionIds: ids.get(f.family) ?? [] };
}

/** Catégories de matchs, et si chacune a déjà une compétition publiée (ou des matchs des sélections). */
export async function familyTabs() {
  const [{ ids, names }, [{ n }]] = await Promise.all([
    competitionFamilies(),
    db.select({ n: count() }).from(nationalFixtures),
  ]);
  // Toutes les catégories sont proposées (un onglet vide l'explique) ; « Autres » seulement s'il en existe.
  return MATCH_FAMILIES.filter((fam) => fam !== "autres" || ids.has(fam)).map(
    (fam) => ({
      family: fam,
      label: names.get(fam) ?? MATCH_FAMILY_LABELS[fam],
      configured: fam === "selections" ? n > 0 : ids.has(fam),
    }),
  );
}

// Constante dans la requête (pas un paramètre) : le GROUP BY doit reconnaître la même expression.
const TZ = sql.raw("'Africa/Brazzaville'");
const dayStart = (date: string) => new Date(`${date}T00:00:00+01:00`);
const addDays = (date: string, n: number) =>
  new Date(dayStart(date).getTime() + n * 86_400_000 + 3_600_000)
    .toISOString()
    .slice(0, 10);
/** Saison sportive : du 1er juillet au 30 juin (heure de Brazzaville). */
const seasonRange = (season: number) =>
  [
    new Date(`${season}-07-01T00:00:00+01:00`),
    new Date(`${season + 1}-07-01T00:00:00+01:00`),
  ] as const;

const NATIONAL_STATUS = {
  SCHEDULED: "UPCOMING",
  PLAYED: "FINISHED",
  CANCELLED: "CANCELLED",
} as const;
const NATIONAL_OF: Partial<
  Record<PublicMatchStatus, ("SCHEDULED" | "PLAYED" | "CANCELLED")[]>
> = { UPCOMING: ["SCHEDULED"], FINISHED: ["PLAYED"], CANCELLED: ["CANCELLED"] };

/** Conditions sur les matchs de club (le statut et le jour sont optionnels : compteurs). */
function clubWhere(
  f: MatchFilters,
  opts: { status?: PublicMatchStatus[]; day?: boolean } = {},
): SQL | undefined {
  const w: SQL[] = [ne(competitions.status, "DRAFT")];
  if (typeof f.competition === "number")
    w.push(eq(matches.competitionId, f.competition));
  if (f.competitionIds)
    w.push(
      f.competitionIds.length
        ? inArray(matches.competitionId, f.competitionIds)
        : sql`false`,
    );
  if (f.season) w.push(eq(competitions.season, f.season));
  if (f.club)
    w.push(or(eq(matches.homeClubId, f.club), eq(matches.awayClubId, f.club))!);
  if (opts.day !== false && f.date)
    w.push(
      gte(matches.kickoffAt, dayStart(f.date)),
      lt(matches.kickoffAt, dayStart(addDays(f.date, 1))),
    );
  if (opts.status)
    w.push(
      inArray(
        matches.status,
        opts.status.flatMap((s) => MATCH_STATUSES_OF[s]),
      ),
    );
  return and(...w);
}

/** Conditions sur les matchs des sélections ; null si les filtres les excluent (compétition ou club choisi). */
function nationalWhere(
  f: MatchFilters,
  opts: { status?: PublicMatchStatus[]; day?: boolean } = {},
): SQL | null | undefined {
  if (typeof f.competition === "number" || f.club || f.competitionIds)
    return null;
  const w: SQL[] = [];
  if (f.season) {
    const [from, to] = seasonRange(f.season);
    w.push(
      gte(nationalFixtures.kickoffAt, from),
      lt(nationalFixtures.kickoffAt, to),
    );
  }
  if (opts.day !== false && f.date)
    w.push(
      gte(nationalFixtures.kickoffAt, dayStart(f.date)),
      lt(nationalFixtures.kickoffAt, dayStart(addDays(f.date, 1))),
    );
  if (opts.status) {
    const list = opts.status.flatMap((s) => NATIONAL_OF[s] ?? []);
    if (list.length === 0) return null;
    w.push(inArray(nationalFixtures.status, list));
  }
  return and(...w);
}

export function fromClub(
  row: MatchRow,
  cupRounds: Map<number, number>,
): FixtureItem {
  const { match: m, competition: c } = row;
  const pool = m.pool ? ` · Poule ${m.pool}` : "";
  return {
    key: `m${m.id}`,
    href: `/matchs/${m.id}`,
    kickoffAt: m.kickoffAt,
    venue: m.venue,
    status: publicMatchStatus(m.status),
    awaiting: m.status === "FINISHED" && !m.validatedAt,
    stale:
      m.status === "SCHEDULED" &&
      m.kickoffAt !== null &&
      m.kickoffAt.getTime() < Date.now() - 3 * 3_600_000,
    halfTime: m.status === "HALF_TIME",
    period: m.period as MatchPeriod | null,
    periodStartedAt: m.periodStartedAt,
    home: {
      id: row.home?.id,
      name: row.home?.name ?? "À déterminer",
      short: row.home?.shortName,
      logo: row.home?.logo,
    },
    away: {
      id: row.away?.id,
      name: row.away?.name ?? "À déterminer",
      short: row.away?.shortName,
      logo: row.away?.logo,
    },
    score:
      m.homeScore !== null && m.awayScore !== null
        ? [m.homeScore, m.awayScore]
        : null,
    penalties:
      m.homePenalties !== null && m.awayPenalties !== null
        ? [m.homePenalties, m.awayPenalties]
        : null,
    group: {
      key: `c${c.id}-${m.round}-${m.pool ?? ""}`,
      title: c.name,
      detail:
        (c.type === "CUP"
          ? roundLabel(m.round, cupRounds.get(c.id) ?? m.round)
          : `Journée ${m.round}`) + pool,
      href: `/competitions/${c.slug}`,
    },
  };
}

type NationalRow = {
  f: typeof nationalFixtures.$inferSelect;
  team: string;
  teamSlug: string;
};
function fromNational({ f, team, teamSlug }: NationalRow): FixtureItem {
  const congo = { name: "Congo", flag: flagUrl("Congo") };
  const opponent = { name: f.opponent, flag: flagUrl(f.opponent) };
  const [home, away] = f.isHome ? [congo, opponent] : [opponent, congo];
  const played = f.goalsFor !== null && f.goalsAgainst !== null;
  return {
    key: `n${f.id}`,
    href: `/equipes-nationales/${teamSlug}`,
    kickoffAt: f.kickoffAt,
    venue: f.venue,
    status: NATIONAL_STATUS[f.status],
    awaiting: false,
    halfTime: false,
    period: null,
    periodStartedAt: null,
    // Drapeau inconnu : pastille aux initiales du pays.
    home: { ...home, flag: home.flag ?? undefined },
    away: { ...away, flag: away.flag ?? undefined },
    score: played
      ? f.isHome
        ? [f.goalsFor!, f.goalsAgainst!]
        : [f.goalsAgainst!, f.goalsFor!]
      : null,
    penalties: null,
    group: {
      key: `n-${teamSlug}-${f.competition ?? ""}`,
      title: team,
      detail: f.competition,
      href: `/equipes-nationales/${teamSlug}`,
    },
  };
}

/** Nombre de tours de chaque coupe présente (libellés « Demi-finales », « Finale »…). */
async function cupRoundsOf(rows: MatchRow[]) {
  const cups = [
    ...new Set(
      rows
        .filter((r) => r.competition.type === "CUP")
        .map((r) => r.competition.id),
    ),
  ];
  if (cups.length === 0) return new Map<number, number>();
  const last = await db
    .select({ id: matches.competitionId, last: max(matches.round) })
    .from(matches)
    .where(inArray(matches.competitionId, cups))
    .groupBy(matches.competitionId);
  return new Map(last.map((r) => [r.id, r.last ?? 1]));
}

/** Rencontres de club et des sélections, dans l'ordre demandé ; `more` : il en reste au-delà de `limit`. */
async function fetchItems(
  f: MatchFilters,
  statuses: PublicMatchStatus[] | undefined,
  order: "asc" | "desc",
  limit: number,
) {
  const nat = nationalWhere(f, { status: statuses });
  const [clubRows, natRows] = await Promise.all([
    f.competition === "selections"
      ? Promise.resolve([] as MatchRow[])
      : matchQuery()
          .where(clubWhere(f, { status: statuses }))
          .orderBy(
            order === "asc"
              ? sql`${matches.kickoffAt} asc nulls last`
              : sql`${matches.kickoffAt} desc nulls last`,
            asc(matches.id),
          )
          .limit(limit + 1),
    nat === null
      ? Promise.resolve([] as NationalRow[])
      : db
          .select({
            f: nationalFixtures,
            team: nationalTeams.name,
            teamSlug: nationalTeams.slug,
          })
          .from(nationalFixtures)
          .innerJoin(
            nationalTeams,
            eq(nationalFixtures.teamId, nationalTeams.id),
          )
          .where(nat)
          .orderBy(
            order === "asc"
              ? asc(nationalFixtures.kickoffAt)
              : desc(nationalFixtures.kickoffAt),
          )
          .limit(limit + 1),
  ]);
  const cupRounds = await cupRoundsOf(clubRows);
  const stale = Date.now() - 3 * 3_600_000;
  const time = (i: FixtureItem) =>
    i.kickoffAt?.getTime() ?? (order === "asc" ? Infinity : -Infinity);
  const all = [
    ...clubRows.map((r) => fromClub(r, cupRounds)),
    ...natRows.map(fromNational),
  ]
    .map((i) =>
      i.status === "UPCOMING" && i.kickoffAt && i.kickoffAt.getTime() < stale
        ? { ...i, stale: true }
        : i,
    )
    .sort((a, b) => (order === "asc" ? time(a) - time(b) : time(b) - time(a)));
  return { items: all.slice(0, limit), more: all.length > limit };
}

/**
 * Page « Matchs et résultats ». Sans jour ni statut : en direct et à venir d'abord, puis les derniers matchs.
 * Un statut terminé, suspendu ou annulé se lit du plus récent au plus ancien ; le reste dans l'ordre du calendrier.
 */
export async function publicFixtures(f: MatchFilters, limit: number) {
  if (f.date || f.status) {
    const desc =
      f.status === "FINISHED" ||
      f.status === "SUSPENDED" ||
      f.status === "CANCELLED";
    const r = await fetchItems(
      f,
      f.status ? [f.status] : undefined,
      f.date ? "asc" : desc ? "desc" : "asc",
      limit,
    );
    // « À venir » : sans les matchs passés dont le résultat n'a pas été saisi.
    if (f.status === "UPCOMING" && !f.date)
      r.items = r.items.filter((i) => !i.stale);
    return { sections: [{ key: "list", title: null as string | null, ...r }] };
  }
  const [upcoming, past] = await Promise.all([
    fetchItems(f, ["LIVE", "UPCOMING", "POSTPONED"], "asc", limit),
    fetchItems(f, ["FINISHED", "SUSPENDED", "CANCELLED"], "desc", limit),
  ]);
  // Un match passé encore « programmé » (résultat non saisi) rejoint les derniers matchs, jamais « à venir ».
  const late = upcoming.items.filter((i) => i.stale);
  const ahead = upcoming.items
    .filter((i) => !i.stale)
    .sort((a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE"));
  const before = [...past.items, ...late].sort(
    (a, b) => (b.kickoffAt?.getTime() ?? 0) - (a.kickoffAt?.getTime() ?? 0),
  );
  return {
    sections: [
      {
        key: "upcoming",
        title: "En direct et à venir",
        items: ahead,
        more: upcoming.more,
      },
      { key: "past", title: "Derniers matchs", items: before, more: past.more },
    ],
  };
}

/** Nombre de rencontres par statut public, avec les autres filtres (onglets). */
export async function fixtureCounts(
  f: MatchFilters,
): Promise<{ counts: Record<PublicMatchStatus, number>; stale: number }> {
  const counts: Record<PublicMatchStatus, number> = {
    LIVE: 0,
    UPCOMING: 0,
    FINISHED: 0,
    POSTPONED: 0,
    SUSPENDED: 0,
    CANCELLED: 0,
  };
  const nat = nationalWhere(f);
  const [clubCounts, natCounts] = await Promise.all([
    f.competition === "selections"
      ? Promise.resolve([])
      : db
          .select({ status: matches.status, n: count() })
          .from(matches)
          .innerJoin(competitions, eq(matches.competitionId, competitions.id))
          .where(clubWhere(f))
          .groupBy(matches.status),
    nat === null
      ? Promise.resolve([])
      : db
          .select({ status: nationalFixtures.status, n: count() })
          .from(nationalFixtures)
          .where(nat)
          .groupBy(nationalFixtures.status),
  ]);
  for (const r of clubCounts) counts[publicMatchStatus(r.status)] += r.n;
  for (const r of natCounts) counts[NATIONAL_STATUS[r.status]] += r.n;
  // Passés mais encore « programmés » (résultat non saisi) : comptés dans « Tous », pas « À venir ».
  const staleAt = new Date(Date.now() - 3 * 3_600_000);
  const [[clubStale], [natStale]] = await Promise.all([
    f.competition === "selections"
      ? Promise.resolve([{ n: 0 }])
      : db
          .select({ n: count() })
          .from(matches)
          .innerJoin(competitions, eq(matches.competitionId, competitions.id))
          .where(
            and(
              clubWhere(f, { status: ["UPCOMING"] }),
              lt(matches.kickoffAt, staleAt),
            ),
          ),
    nat === null
      ? Promise.resolve([{ n: 0 }])
      : db
          .select({ n: count() })
          .from(nationalFixtures)
          .where(
            and(
              nationalWhere(f, { status: ["UPCOMING"] }) ?? undefined,
              lt(nationalFixtures.kickoffAt, staleAt),
            ),
          ),
  ]);
  counts.UPCOMING -= clubStale.n + natStale.n;
  return { counts, stale: clubStale.n + natStale.n };
}

/** Nombre de rencontres par jour sur une semaine à partir de `from` (barre des dates). */
export async function fixturesByDay(f: MatchFilters, from: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const [start, end] = [dayStart(days[0]), dayStart(addDays(from, 7))];
  const statuses = f.status ? [f.status] : undefined;
  const nat = nationalWhere(f, { status: statuses, day: false });
  const clubDay = sql<string>`to_char(${matches.kickoffAt} at time zone ${TZ}, 'YYYY-MM-DD')`;
  const natDay = sql<string>`to_char(${nationalFixtures.kickoffAt} at time zone ${TZ}, 'YYYY-MM-DD')`;
  const [a, b] = await Promise.all([
    f.competition === "selections"
      ? Promise.resolve([])
      : db
          .select({ day: clubDay, n: count() })
          .from(matches)
          .innerJoin(competitions, eq(matches.competitionId, competitions.id))
          .where(
            and(
              clubWhere(f, { status: statuses, day: false }),
              gte(matches.kickoffAt, start),
              lt(matches.kickoffAt, end),
            ),
          )
          .groupBy(clubDay),
    nat === null
      ? Promise.resolve([])
      : db
          .select({ day: natDay, n: count() })
          .from(nationalFixtures)
          .where(
            and(
              nat,
              gte(nationalFixtures.kickoffAt, start),
              lt(nationalFixtures.kickoffAt, end),
            ),
          )
          .groupBy(natDay),
  ]);
  const n = new Map<string, number>();
  for (const r of [...a, ...b]) n.set(r.day, (n.get(r.day) ?? 0) + r.n);
  return days.map((day) => ({ day, count: n.get(day) ?? 0 }));
}

/** Choix des filtres : compétitions publiées, saisons, clubs engagés. */
export async function fixtureFilterOptions() {
  const [comps, clubList] = await Promise.all([
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        season: competitions.season,
      })
      .from(competitions)
      .where(ne(competitions.status, "DRAFT"))
      .orderBy(desc(competitions.season), asc(competitions.name)),
    db
      .selectDistinct({ id: clubs.id, name: clubs.name })
      .from(competitionTeams)
      .innerJoin(
        competitions,
        eq(competitionTeams.competitionId, competitions.id),
      )
      .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
      .where(ne(competitions.status, "DRAFT"))
      .orderBy(asc(clubs.name)),
  ]);
  const seasons = [...new Set(comps.map((c) => c.season))].sort(
    (a, b) => b - a,
  );
  return { comps, clubs: clubList, seasons };
}

/**
 * Matchs d'une catégorie pour la page d'accueil : quelques prochains (le direct d'abord) et derniers matchs.
 * Un match passé sans résultat saisi n'est jamais présenté « à venir ».
 */
export async function homeFixtures(family: MatchFamily, limit: number) {
  const f = await withFamily({ family });
  const [upcoming, recent] = await Promise.all([
    fetchItems(f, ["LIVE", "UPCOMING", "POSTPONED"], "asc", limit + 6),
    fetchItems(f, ["FINISHED", "SUSPENDED", "CANCELLED"], "desc", limit),
  ]);
  return {
    upcoming: upcoming.items
      .filter((i) => !i.stale)
      .sort((a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE"))
      .slice(0, limit),
    recent: recent.items,
  };
}

/**
 * « À la une » : matchs mis en avant par l'organisateur ou la fédération (indicateur saisi en
 * administration), en direct ou à venir. Aucune sélection automatique.
 */
export async function featuredFixtures(limit = 3) {
  const since = new Date(Date.now() - 3 * 3_600_000);
  const [clubRows, natRows] = await Promise.all([
    matchQuery()
      .where(
        and(
          eq(matches.featured, true),
          ne(competitions.status, "DRAFT"),
          or(
            inArray(matches.status, ["LIVE", "HALF_TIME"]),
            and(eq(matches.status, "SCHEDULED"), gte(matches.kickoffAt, since)),
          ),
        ),
      )
      .orderBy(asc(matches.kickoffAt))
      .limit(limit),
    db
      .select({
        f: nationalFixtures,
        team: nationalTeams.name,
        teamSlug: nationalTeams.slug,
      })
      .from(nationalFixtures)
      .innerJoin(nationalTeams, eq(nationalFixtures.teamId, nationalTeams.id))
      .where(
        and(
          eq(nationalFixtures.featured, true),
          eq(nationalFixtures.status, "SCHEDULED"),
          gte(nationalFixtures.kickoffAt, since),
        ),
      )
      .orderBy(asc(nationalFixtures.kickoffAt))
      .limit(limit),
  ]);
  const cupRounds = await cupRoundsOf(clubRows);
  return [
    ...clubRows.map((r) => fromClub(r, cupRounds)),
    ...natRows.map(fromNational),
  ]
    .sort(
      (a, b) =>
        Number(b.status === "LIVE") - Number(a.status === "LIVE") ||
        (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
    )
    .slice(0, limit);
}

/**
 * Colonne des compétitions (page Matchs, sur ordinateur) : nombre de rencontres et de matchs en direct
 * de chaque compétition, avec les autres filtres.
 */
export async function fixturesByCompetition(f: MatchFilters) {
  const g: MatchFilters = {
    ...f,
    competition: f.competition === "selections" ? undefined : f.competition,
  };
  const base = { ...g, competition: undefined };
  const nat = nationalWhere(base, {
    status: f.status ? [f.status] : undefined,
  });
  const liveCount = sql<number>`count(*) filter (where ${matches.status} in ('LIVE', 'HALF_TIME'))::int`;
  const [clubRows, [natRow]] = await Promise.all([
    f.family === "selections"
      ? Promise.resolve(
          [] as { id: number; name: string; n: number; live: number }[],
        )
      : db
          .select({
            id: competitions.id,
            name: competitions.name,
            n: count(),
            live: liveCount,
          })
          .from(matches)
          .innerJoin(competitions, eq(matches.competitionId, competitions.id))
          .where(clubWhere(base, { status: f.status ? [f.status] : undefined }))
          .groupBy(competitions.id, competitions.name)
          .orderBy(asc(competitions.name)),
    nat === null
      ? Promise.resolve([{ n: 0 }])
      : db.select({ n: count() }).from(nationalFixtures).where(nat),
  ]);
  return { competitions: clubRows, national: natRow.n };
}

const validated = and(
  eq(matches.status, "FINISHED"),
  isNotNull(matches.validatedAt),
);

/**
 * Forme d'un club : ses 8 derniers résultats validés (toutes compétitions) avant le match affiché, du plus
 * ancien au plus récent, et ses séries en cours (victoires d'affilée, matchs sans défaite).
 */
export async function clubRecord(
  clubId: number,
  before: Date | null,
  excludeMatch: number,
) {
  const rows = await matchQuery()
    .where(
      and(
        validated,
        ne(competitions.status, "DRAFT"),
        ne(matches.id, excludeMatch),
        or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId)),
        before ? lt(matches.kickoffAt, before) : undefined,
      ),
    )
    .orderBy(desc(matches.kickoffAt))
    .limit(30);
  const results = rows.map(({ match: m, home, away }) => {
    const [mine, theirs] =
      m.homeClubId === clubId
        ? [m.homeScore ?? 0, m.awayScore ?? 0]
        : [m.awayScore ?? 0, m.homeScore ?? 0];
    const result: "V" | "N" | "D" =
      mine > theirs ? "V" : mine === theirs ? "N" : "D";
    const opponent = m.homeClubId === clubId ? away?.name : home?.name;
    return {
      id: m.id,
      result,
      label: `${result === "V" ? "Victoire" : result === "N" ? "Nul" : "Défaite"} ${mine}-${theirs} contre ${opponent ?? "?"}`,
    };
  });
  return {
    form: results.slice(0, 8).reverse(),
    streaks: streaks(results.map((r) => r.result)),
  };
}

/** Buts marqués et encaissés par tranche de 15 minutes, et meilleurs buteurs d'un club dans une compétition (résultats validés). */
export async function clubGoalProfile(competitionId: number, clubId: number) {
  const events = await db
    .select({
      type: matchEvents.type,
      minute: matchEvents.minute,
      clubId: matchEvents.clubId,
      playerId: matchEvents.playerId,
      lastName: players.lastName,
      firstName: players.firstName,
    })
    .from(matchEvents)
    .innerJoin(matches, eq(matchEvents.matchId, matches.id))
    .leftJoin(players, eq(matchEvents.playerId, players.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        validated,
        or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId)),
      ),
    );
  const scorers = new Map<number, { name: string; goals: number }>();
  for (const e of events) {
    if (
      (e.type === "GOAL" || e.type === "PENALTY_GOAL") &&
      e.clubId === clubId &&
      e.playerId !== null
    ) {
      const cur = scorers.get(e.playerId) ?? {
        name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
        goals: 0,
      };
      scorers.set(e.playerId, { ...cur, goals: cur.goals + 1 });
    }
  }
  return {
    ...goalBuckets(events, clubId),
    scorers: [...scorers.values()]
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 3),
  };
}

/** Joueurs d'un club suspendus pour son prochain match dans la compétition (cartons, décisions de la commission). */
export async function suspendedFor(clubId: number, competitionId: number) {
  const map = await suspendedPlayers(clubId, competitionId);
  if (map.size === 0) return [];
  const rows = await db
    .select({
      id: players.id,
      lastName: players.lastName,
      firstName: players.firstName,
    })
    .from(players)
    .where(inArray(players.id, [...map.keys()]));
  return rows.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    reason: map.get(p.id)!,
  }));
}

/** Autres matchs de la même journée (ou du même tour, de la même poule). */
export async function roundFixtures(
  competitionId: number,
  round: number,
  pool: string | null,
  excludeMatch: number,
) {
  const rows = await matchQuery()
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(matches.round, round),
        pool ? eq(matches.pool, pool) : undefined,
        ne(matches.id, excludeMatch),
      ),
    )
    .orderBy(
      sql`${matches.kickoffAt} asc nulls last`,
      asc(matches.bracketSlot),
      asc(matches.id),
    );
  const cupRounds = await cupRoundsOf(rows);
  return rows.map((r) => fromClub(r, cupRounds));
}

/** Face-à-face : rencontres validées entre deux clubs (les plus récentes d'abord) et bilan. */
export async function headToHead(a: number, b: number, excludeMatch: number) {
  const rows = await matchQuery()
    .where(
      and(
        validated,
        ne(competitions.status, "DRAFT"),
        ne(matches.id, excludeMatch),
        or(
          and(eq(matches.homeClubId, a), eq(matches.awayClubId, b)),
          and(eq(matches.homeClubId, b), eq(matches.awayClubId, a)),
        ),
      ),
    )
    .orderBy(desc(matches.kickoffAt))
    .limit(10);
  const tally = { a: 0, draws: 0, b: 0 };
  for (const { match: m } of rows) {
    const [ga, gb] =
      m.homeClubId === a
        ? [m.homeScore ?? 0, m.awayScore ?? 0]
        : [m.awayScore ?? 0, m.homeScore ?? 0];
    if (ga > gb) tally.a++;
    else if (ga < gb) tally.b++;
    else tally.draws++;
  }
  const cupRounds = await cupRoundsOf(rows);
  return { items: rows.map((r) => fromClub(r, cupRounds)), tally };
}

/** Ligues départementales actives, par département (onglet « Ligues départementales » de l'accueil). */
export async function departmentalLeagues() {
  return db
    .select({
      code: leagues.code,
      name: leagues.name,
      department: leagues.department,
    })
    .from(leagues)
    .where(eq(leagues.active, true))
    .orderBy(asc(leagues.department));
}

/**
 * Billetterie ouverte (prévente membres ou vente publique, avant le coup d'envoi) des matchs donnés :
 * bouton « Acheter un billet » sur leur page.
 */
export async function openTicketSales(opts: {
  matchIds?: number[];
  fixtureIds?: number[];
}) {
  const { matchIds = [], fixtureIds = [] } = opts;
  if (matchIds.length === 0 && fixtureIds.length === 0) return [];
  return db
    .select({
      slug: ticketEvents.slug,
      salesStatus: ticketEvents.salesStatus,
      matchId: ticketEvents.matchId,
      fixtureId: ticketEvents.nationalFixtureId,
    })
    .from(ticketEvents)
    .where(
      and(
        inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN"]),
        gte(ticketEvents.kickoffAt, new Date()),
        or(
          matchIds.length ? inArray(ticketEvents.matchId, matchIds) : undefined,
          fixtureIds.length
            ? inArray(ticketEvents.nationalFixtureId, fixtureIds)
            : undefined,
        ),
      ),
    );
}

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Brazzaville",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Rencontres à venir auxquelles relier un événement de billetterie : matchs de club programmés (équipes
 * connues) et matchs des sélections. Valeur « m:<id> » ou « n:<id> ».
 */
export async function ticketableFixtures() {
  const now = new Date();
  const [club, nat] = await Promise.all([
    matchQuery()
      .where(
        and(
          eq(matches.status, "SCHEDULED"),
          gte(matches.kickoffAt, now),
          ne(competitions.status, "DRAFT"),
          isNotNull(matches.homeClubId),
          isNotNull(matches.awayClubId),
        ),
      )
      .orderBy(asc(matches.kickoffAt))
      .limit(200),
    db
      .select({ f: nationalFixtures, team: nationalTeams.name })
      .from(nationalFixtures)
      .innerJoin(nationalTeams, eq(nationalFixtures.teamId, nationalTeams.id))
      .where(
        and(
          eq(nationalFixtures.status, "SCHEDULED"),
          gte(nationalFixtures.kickoffAt, now),
        ),
      )
      .orderBy(asc(nationalFixtures.kickoffAt)),
  ]);
  return [
    ...nat.map(({ f, team }) => ({
      value: `n:${f.id}`,
      label: `${shortDate.format(f.kickoffAt)} · ${f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`} (${team})`,
    })),
    ...club.map(({ match: m, home, away, competition }) => ({
      value: `m:${m.id}`,
      label: `${m.kickoffAt ? shortDate.format(m.kickoffAt) : ""} · ${home?.name} – ${away?.name} (${competition.name})`,
    })),
  ];
}

export { addDays };
