/**
 * Règles des compétitions (M07) — fichier pur, testé unitairement.
 * EF-CMP-01 à EF-CMP-08, RG-07.
 */

export const COMPETITION_TYPES = ["LEAGUE", "CUP"] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];
export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  LEAGUE: "Championnat / tournoi (poules)",
  CUP: "Coupe (élimination directe)",
};

export const COMPETITION_STATUSES = ["DRAFT", "ONGOING", "FINISHED"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];
export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  DRAFT: "En préparation",
  ONGOING: "En cours",
  FINISHED: "Terminée",
};

/**
 * Statut affiché sur le portail : celui enregistré par l'organisateur, jamais déduit des dates.
 * Seule nuance : une compétition publiée dont aucun match n'a commencé est « À venir ».
 */
export type PublicStatus = "UPCOMING" | CompetitionStatus;
export const publicStatus = (status: CompetitionStatus, played: number): PublicStatus => (status === "ONGOING" && played === 0 ? "UPCOMING" : status);
export const PUBLIC_STATUS_LABELS: Record<PublicStatus, string> = { ...COMPETITION_STATUS_LABELS, UPCOMING: "À venir" };
export const publicStatusLabel = (status: CompetitionStatus, played: number) => PUBLIC_STATUS_LABELS[publicStatus(status, played)];

/** Format d'une compétition, tel que configuré : championnat à points, poules, ou élimination directe. */
export function formatLabel(c: { type: CompetitionType; doubleRound: boolean }, pools: number): string {
  if (c.type === "CUP") return "Coupe à élimination directe";
  const legs = c.doubleRound ? "aller-retour" : "aller simple";
  return pools > 1 ? `Championnat en ${pools} poules (${legs})` : `Championnat à points (${legs})`;
}

export const GENDERS = ["M", "F"] as const;

/**
 * Catégories des compétitions : celles des licences, plus les U23 (compétitions espoirs).
 * Une compétition U23 accueille des licenciés U20 et seniors : la catégorie ne filtre pas les engagements.
 */
export const COMPETITION_CATEGORIES = ["U13", "U15", "U17", "U20", "U23", "SENIOR", "VETERAN"] as const;
export type CompetitionCategory = (typeof COMPETITION_CATEGORIES)[number];
export const COMPETITION_CATEGORY_LABELS: Record<CompetitionCategory, string> = {
  U13: "Moins de 13 ans",
  U15: "Moins de 15 ans",
  U17: "Moins de 17 ans",
  U20: "Moins de 20 ans",
  U23: "Moins de 23 ans",
  SENIOR: "Senior",
  VETERAN: "Vétéran (35 ans et plus)",
};

/**
 * Statut sportif d'un club à l'issue d'une saison (fixé par l'organisateur selon le règlement) :
 * il prépare la saison suivante (maintenus et promus reconduits, relégués vers la division inférieure).
 */
export const TEAM_OUTCOMES = ["CHAMPION", "PROMOTED", "MAINTAINED", "RELEGATED", "WITHDRAWN", "EXCLUDED"] as const;
export type TeamOutcome = (typeof TEAM_OUTCOMES)[number];
export const TEAM_OUTCOME_LABELS: Record<TeamOutcome, string> = {
  CHAMPION: "Champion",
  PROMOTED: "Promu",
  MAINTAINED: "Maintenu",
  RELEGATED: "Relégué",
  WITHDRAWN: "Forfait général",
  EXCLUDED: "Exclu",
};

/**
 * Clubs proposés pour la saison suivante d'un championnat de niveau `tier` (1 = Ligue 1) :
 * ses clubs non relégués ni promus ni sortis, plus les promus du niveau inférieur et les relégués du niveau supérieur.
 * Proposition seulement : l'organisateur ajuste les engagements selon le règlement.
 */
export function nextSeasonClubs(current: { clubId: number; outcome: TeamOutcome | null }[], lower: { clubId: number; outcome: TeamOutcome | null }[], upper: { clubId: number; outcome: TeamOutcome | null }[]): number[] {
  const leaving = new Set<TeamOutcome>(["PROMOTED", "RELEGATED", "WITHDRAWN", "EXCLUDED"]);
  const stay = current.filter((t) => !t.outcome || !leaving.has(t.outcome)).map((t) => t.clubId);
  const up = lower.filter((t) => t.outcome === "PROMOTED").map((t) => t.clubId);
  const down = upper.filter((t) => t.outcome === "RELEGATED").map((t) => t.clubId);
  return [...new Set([...stay, ...up, ...down])];
}

/** Zone d'un rang (1 = premier) au classement : montée en tête, descente en bas, selon la saison. */
export function standingZone(rank: number, size: number, spots: { promotion: number; relegation: number }): "promotion" | "relegation" | null {
  if (spots.promotion > 0 && rank <= spots.promotion) return "promotion";
  if (spots.relegation > 0 && rank > size - spots.relegation) return "relegation";
  return null;
}

/** Portée d'une compétition : nationale (fédération) ou départementale (une ligue). */
export const scopeLabel = (league: { name: string } | null) => league?.name ?? "Compétition nationale";
export const COMPETITION_GENDER_LABELS = { M: "Masculin", F: "Féminin" } as const;

export const MATCH_STATUSES = ["SCHEDULED", "LIVE", "HALF_TIME", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELLED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: "Programmé",
  LIVE: "En cours",
  HALF_TIME: "Mi-temps",
  FINISHED: "Terminé",
  POSTPONED: "Reporté",
  SUSPENDED: "Suspendu",
  CANCELLED: "Annulé",
};

/** En cours de jeu (saisie officielle depuis la feuille de match) : score affiché « en direct ». */
export const isLive = (status: MatchStatus) => status === "LIVE" || status === "HALF_TIME";
/** Un score existe : match en cours ou terminé. */
export const hasScore = (status: MatchStatus) => isLive(status) || status === "FINISHED";
/** Date, heure, stade et équipes ne se modifient plus une fois le match commencé (reporté : reprogrammable). */
export const canReschedule = (status: MatchStatus) => status === "SCHEDULED" || status === "POSTPONED";

// ─── Catégories de matchs (portail) ──────────────────────────────────────────

/** Familles de rencontres proposées au public, dans l'ordre des onglets. */
export const MATCH_FAMILIES = ["selections", "ligue-1", "ligue-2", "departementales", "coupes", "feminin", "jeunes", "autres"] as const;
export type MatchFamily = (typeof MATCH_FAMILIES)[number];
export const MATCH_FAMILY_LABELS: Record<MatchFamily, string> = {
  selections: "Sélections nationales",
  "ligue-1": "Ligue 1",
  "ligue-2": "Ligue 2",
  departementales: "Ligues départementales",
  coupes: "Coupes",
  feminin: "Football féminin",
  jeunes: "Jeunes",
  autres: "Autres compétitions",
};

/**
 * Famille d'une compétition, d'après sa configuration : le football féminin et les jeunes d'abord
 * (une Ligue départementale U17 est une compétition de jeunes), puis les divisions nationales (niveau
 * du championnat), les compétitions des ligues, les coupes nationales, et le reste.
 */
export function competitionFamily(c: { gender: "M" | "F"; category: CompetitionCategory; leagueId: number | null; type: CompetitionType; tier: number | null }): Exclude<MatchFamily, "selections"> {
  if (c.gender === "F") return "feminin";
  if (c.category !== "SENIOR" && c.category !== "VETERAN") return "jeunes";
  if (c.tier === 1) return "ligue-1";
  if (c.tier === 2) return "ligue-2";
  if (c.leagueId !== null) return "departementales";
  if (c.type === "CUP") return "coupes";
  return "autres";
}

// ─── Statut public et historique d'un match ──────────────────────────────────

/** Statuts présentés au public : la mi-temps fait partie du direct. */
export const PUBLIC_MATCH_STATUSES = ["LIVE", "UPCOMING", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELLED"] as const;
export type PublicMatchStatus = (typeof PUBLIC_MATCH_STATUSES)[number];
export const PUBLIC_MATCH_STATUS_LABELS: Record<PublicMatchStatus, string> = {
  LIVE: "En direct",
  UPCOMING: "À venir",
  FINISHED: "Terminé",
  POSTPONED: "Reporté",
  SUSPENDED: "Suspendu",
  CANCELLED: "Annulé",
};
/** Statuts enregistrés correspondant à chaque statut public. */
export const MATCH_STATUSES_OF: Record<PublicMatchStatus, MatchStatus[]> = {
  LIVE: ["LIVE", "HALF_TIME"],
  UPCOMING: ["SCHEDULED"],
  FINISHED: ["FINISHED"],
  POSTPONED: ["POSTPONED"],
  SUSPENDED: ["SUSPENDED"],
  CANCELLED: ["CANCELLED"],
};
export const publicMatchStatus = (status: MatchStatus): PublicMatchStatus => (isLive(status) ? "LIVE" : status === "SCHEDULED" ? "UPCOMING" : status);

type AuditEntry = { action: string; details: unknown; createdAt: Date };
type SheetDetails = { before?: { status?: MatchStatus; kickoffAt?: string | null }; after?: { status?: MatchStatus; score?: (number | null)[]; kickoffAt?: string | null }; validated?: boolean };

const STATUS_STEP: Partial<Record<MatchStatus, string>> = {
  HALF_TIME: "Mi-temps",
  FINISHED: "Fin du match",
  POSTPONED: "Match reporté",
  SUSPENDED: "Match suspendu",
  CANCELLED: "Match annulé",
};

/**
 * Historique public d'un match, tiré du journal : programmation, coup d'envoi, mi-temps, report,
 * suspension, fin, validation et correction du résultat. Ni auteur ni détail interne.
 */
export function matchHistory(entries: AuditEntry[]): { at: Date; label: string; kickoffAt?: Date }[] {
  const out: { at: Date; label: string; kickoffAt?: Date }[] = [];
  let validated = false;
  for (const e of [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const d = (e.details ?? {}) as SheetDetails;
    if (e.action === "SCHEDULE" && d.after?.kickoffAt) {
      out.push({ at: e.createdAt, label: d.before?.kickoffAt ? "Match reprogrammé" : "Match programmé", kickoffAt: new Date(d.after.kickoffAt) });
    } else if (e.action === "MATCH_SHEET" || e.action === "RESULT_CORRECTION") {
      const before = d.before?.status;
      const after = d.after?.status;
      if (after && after !== before) {
        const label = after === "LIVE" ? (before === "HALF_TIME" ? "Reprise du jeu" : "Coup d'envoi") : STATUS_STEP[after];
        if (label) out.push({ at: e.createdAt, label });
      }
      if (e.action === "RESULT_CORRECTION" && d.after?.score?.every((x) => x !== null)) {
        out.push({ at: e.createdAt, label: `Résultat corrigé par l'organisateur : ${d.after.score.join(" – ")}` });
      } else if (d.validated && !validated) {
        out.push({ at: e.createdAt, label: "Résultat validé par l'organisateur" });
      }
      validated = Boolean(d.validated);
    } else if (e.action === "RESULT_VALIDATED" && !validated) {
      out.push({ at: e.createdAt, label: "Résultat validé par l'organisateur" });
      validated = true;
    }
  }
  return out;
}

// ─── Composition sur le terrain ──────────────────────────────────────────────

type PitchPlayer = { position: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" | null };

/**
 * Lignes d'une composition (gardien, défense, milieu, attaque) d'après les postes des titulaires,
 * et le système qui en découle (« 4-4-2 »). Un poste inconnu compte au milieu ; sans gardien désigné,
 * personne n'est placé dans le but.
 */
export function pitchLines<T extends PitchPlayer>(starters: T[]): { lines: [T[], T[], T[], T[]]; formation: string | null } {
  const of = (p: PitchPlayer["position"]) => starters.filter((s) => (s.position ?? "MIDFIELDER") === p);
  const lines: [T[], T[], T[], T[]] = [of("GOALKEEPER"), of("DEFENDER"), of("MIDFIELDER"), of("FORWARD")];
  const outfield = lines.slice(1).map((l) => l.length).filter((n) => n > 0);
  return { lines, formation: starters.length >= 7 && outfield.length >= 2 ? outfield.join("-") : null };
}

// ─── Minute de jeu en direct ─────────────────────────────────────────────────

/** Périodes d'un match : deux mi-temps, puis deux prolongations (coupes). */
export const MATCH_PERIODS = [1, 2, 3, 4] as const;
export type MatchPeriod = (typeof MATCH_PERIODS)[number];
export const MATCH_PERIOD_LABELS: Record<MatchPeriod, string> = {
  1: "1re mi-temps",
  2: "2e mi-temps",
  3: "1re prolongation",
  4: "2e prolongation",
};
/** Minutes de jeu au début et à la fin réglementaire de chaque période. */
const PERIOD_BOUNDS: Record<MatchPeriod, [number, number]> = { 1: [0, 45], 2: [45, 90], 3: [90, 105], 4: [105, 120] };

/**
 * Période en cours après une mise à jour de la feuille de match, et redémarrage ou non du chronomètre.
 * Coup d'envoi (programmé → en direct) : 1re mi-temps. Reprise après la pause : période suivante.
 * Une période choisie explicitement par l'officiel prime. Le chronomètre ne repart qu'au changement de période.
 */
export function nextPeriod(
  before: { status: MatchStatus; period: MatchPeriod | null },
  after: { status: MatchStatus; period: MatchPeriod | null },
): { period: MatchPeriod | null; restart: boolean } {
  if (after.status !== "LIVE") return { period: before.period, restart: false };
  const wasLive = before.status === "LIVE";
  const automatic: MatchPeriod = wasLive
    ? (before.period ?? 1)
    : before.status === "HALF_TIME" && before.period
      ? (Math.min(4, before.period + 1) as MatchPeriod)
      : 1;
  const period = after.period ?? automatic;
  return { period, restart: !wasLive || period !== before.period };
}

/**
 * Minute affichée d'un match en cours : « 37' », ou « 45+2' » au-delà du temps réglementaire de la période.
 * Null sans période ni heure de reprise (score fourni par une source externe, par exemple).
 */
export function liveMinute(period: MatchPeriod | null, startedAt: Date | null, now: Date = new Date()): string | null {
  if (!period || !startedAt) return null;
  const [start, end] = PERIOD_BOUNDS[period];
  const elapsed = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000));
  const minute = start + elapsed + 1;
  return minute > end ? `${end}+${Math.min(minute - end, 30)}'` : `${minute}'`;
}

export const EVENT_TYPES = ["GOAL", "PENALTY_GOAL", "OWN_GOAL", "YELLOW_CARD", "RED_CARD", "SUBSTITUTION"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  GOAL: "But",
  PENALTY_GOAL: "But sur penalty",
  OWN_GOAL: "But contre son camp",
  YELLOW_CARD: "Carton jaune",
  RED_CARD: "Carton rouge",
  SUBSTITUTION: "Remplacement",
};
export const GOAL_EVENTS: readonly EventType[] = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"];

// ─── Calendrier « toutes rondes » (EF-CMP-03) ────────────────────────────────

export type Pairing = { round: number; home: number; away: number };

/**
 * Méthode du « cercle » : chaque équipe rencontre toutes les autres une fois par phase,
 * une seule rencontre par journée et par équipe, domicile/extérieur alternés.
 * Avec un nombre impair d'équipes, une équipe est exempte à chaque journée.
 * En aller-retour, la phase retour inverse les réceptions.
 */
export function roundRobin(teamIds: number[], opts: { doubleRound: boolean }): Pairing[] {
  if (teamIds.length < 2) return [];
  const BYE = -1;
  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = teams.length;
  const rounds = n - 1;
  const firstLeg: Pairing[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      // Le pivot (i = 0) alterne à chaque journée ; les autres paires alternent selon leur position.
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      firstLeg.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b });
    }
    // Rotation : le premier reste fixe, les autres tournent d'un cran.
    teams.splice(1, 0, teams.pop()!);
  }

  if (!opts.doubleRound) return firstLeg;
  return [...firstLeg, ...firstLeg.map((p) => ({ round: p.round + rounds, home: p.away, away: p.home }))];
}

// ─── Score et classement (RG-07, EF-CMP-06) ──────────────────────────────────

export type MatchEvent = { type: EventType; clubId: number; playerId: number | null; minute: number };

/**
 * Score calculé à partir des buts saisis. `clubId` est le club du joueur :
 * un but contre son camp est crédité à l'adversaire (RG-07).
 */
export function scoreFromEvents(events: MatchEvent[], homeId: number, awayId: number): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type === "GOAL" || e.type === "PENALTY_GOAL") {
      if (e.clubId === homeId) home++;
      else if (e.clubId === awayId) away++;
    } else if (e.type === "OWN_GOAL") {
      if (e.clubId === homeId) away++;
      else if (e.clubId === awayId) home++;
    }
  }
  return { home, away };
}

export type PointsRule = { win: number; draw: number; loss: number };

export type StandingRow = {
  clubId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  penalty: number;
  points: number;
  /** Cinq derniers résultats, du plus ancien au plus récent : V, N, D. */
  form: ("V" | "N" | "D")[];
};

type FinishedMatch = { homeClubId: number; awayClubId: number; homeScore: number; awayScore: number; kickoffAt: Date | null };

/**
 * Critères de départage à égalité de points, appliqués dans l'ordre choisi pour la compétition.
 * Les critères « confrontations directes » ne comptent que les matchs entre les équipes encore à égalité.
 */
export const TIEBREAKERS = ["GOAL_DIFF", "GOALS_FOR", "WINS", "H2H_POINTS", "H2H_GOAL_DIFF", "H2H_GOALS_FOR"] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];
export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  GOAL_DIFF: "Différence de buts générale",
  GOALS_FOR: "Buts marqués",
  WINS: "Nombre de victoires",
  H2H_POINTS: "Points en confrontations directes",
  H2H_GOAL_DIFF: "Différence de buts en confrontations directes",
  H2H_GOALS_FOR: "Buts marqués en confrontations directes",
};
/** Règle par défaut de la plateforme (RG-07) : points, différence de buts, buts marqués. */
export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ["GOAL_DIFF", "GOALS_FOR"];

/** Liste de critères valide : connus, sans doublon ; vide → règle par défaut. */
export function parseTiebreakers(values: unknown[]): Tiebreaker[] {
  const list = values.filter((v): v is Tiebreaker => TIEBREAKERS.includes(v as Tiebreaker));
  const unique = [...new Set(list)];
  return unique.length ? unique : [...DEFAULT_TIEBREAKERS];
}

/** Mini-classement entre les seules équipes `ids` : points, différence et buts marqués. */
function headToHead(ids: Set<number>, matches: FinishedMatch[], rule: PointsRule) {
  const t = new Map([...ids].map((id) => [id, { points: 0, diff: 0, goals: 0 }]));
  for (const m of matches) {
    if (!ids.has(m.homeClubId) || !ids.has(m.awayClubId)) continue;
    for (const [id, gf, ga] of [
      [m.homeClubId, m.homeScore, m.awayScore],
      [m.awayClubId, m.awayScore, m.homeScore],
    ] as const) {
      const r = t.get(id)!;
      r.points += gf > ga ? rule.win : gf === ga ? rule.draw : rule.loss;
      r.diff += gf - ga;
      r.goals += gf;
    }
  }
  return t;
}

/** Ordonne un groupe à égalité en appliquant les critères un par un (chaque critère recalculé sur le sous-groupe restant). */
function breakTies(group: StandingRow[], criteria: Tiebreaker[], matches: FinishedMatch[], rule: PointsRule): StandingRow[] {
  if (group.length < 2 || criteria.length === 0) return [...group].sort((a, b) => a.clubId - b.clubId);
  const [c, ...rest] = criteria;
  let value: (r: StandingRow) => number;
  if (c.startsWith("H2H_")) {
    const h = headToHead(new Set(group.map((r) => r.clubId)), matches, rule);
    const key = c === "H2H_POINTS" ? "points" : c === "H2H_GOAL_DIFF" ? "diff" : "goals";
    value = (r) => h.get(r.clubId)![key];
  } else {
    value = c === "GOAL_DIFF" ? (r) => r.goalDiff : c === "GOALS_FOR" ? (r) => r.goalsFor : (r) => r.won;
  }
  const buckets = new Map<number, StandingRow[]>();
  for (const r of group) buckets.set(value(r), [...(buckets.get(value(r)) ?? []), r]);
  return [...buckets.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, rows]) => breakTies(rows, rest, matches, rule));
}

/** Classement : points, puis les critères de départage de la compétition (RG-07) ; pénalités de points déduites. */
export function standings(
  teamIds: number[],
  matches: FinishedMatch[],
  rule: PointsRule,
  penalties: Map<number, number> = new Map(),
  tiebreakers: Tiebreaker[] = DEFAULT_TIEBREAKERS,
): StandingRow[] {
  const rows = new Map<number, StandingRow>(
    teamIds.map((id) => [
      id,
      { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, penalty: penalties.get(id) ?? 0, points: 0, form: [] },
    ]),
  );
  const ordered = [...matches].sort((a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0));

  for (const m of ordered) {
    const home = rows.get(m.homeClubId);
    const away = rows.get(m.awayClubId);
    if (!home || !away) continue;
    for (const [row, gf, ga] of [
      [home, m.homeScore, m.awayScore],
      [away, m.awayScore, m.homeScore],
    ] as const) {
      row.played++;
      row.goalsFor += gf;
      row.goalsAgainst += ga;
      const result: "V" | "N" | "D" = gf > ga ? "V" : gf === ga ? "N" : "D";
      if (result === "V") row.won++;
      else if (result === "N") row.drawn++;
      else row.lost++;
      row.form = [...row.form, result].slice(-5);
    }
  }

  for (const r of rows.values()) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.points = r.won * rule.win + r.drawn * rule.draw + r.lost * rule.loss - r.penalty;
  }
  const byPoints = new Map<number, StandingRow[]>();
  for (const r of rows.values()) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r]);
  return [...byPoints.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, group]) => breakTies(group, tiebreakers, ordered, rule));
}

/** Meilleurs buteurs : buts et penalties, sans les buts contre son camp. */
export function topScorers(events: { type: EventType; playerId: number | null }[]): { playerId: number; goals: number }[] {
  const goals = new Map<number, number>();
  for (const e of events) {
    if ((e.type === "GOAL" || e.type === "PENALTY_GOAL") && e.playerId !== null) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
  }
  return [...goals.entries()].map(([playerId, n]) => ({ playerId, goals: n })).sort((a, b) => b.goals - a.goals || a.playerId - b.playerId);
}

// ─── Coupes à élimination directe (EF-CMP-08) ────────────────────────────────

export type BracketSlot = { round: number; slot: number; home: number | null; away: number | null };

export const nextPowerOfTwo = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/**
 * Tableau à élimination directe à partir de l'ordre du tirage au sort.
 * Si le nombre d'équipes n'est pas une puissance de 2, les premières tirées sont exemptes
 * du premier tour (adversaire vide) et passent directement au tour suivant. Les exemptions sont
 * réparties régulièrement dans le tableau : deux exemptés ne se rencontrent pas dès le 2e tour.
 */
export function buildBracket(drawOrder: number[]): BracketSlot[] {
  const size = nextPowerOfTwo(drawOrder.length);
  const half = size / 2;
  const byes = size - drawOrder.length;
  const byeSlots = new Set(Array.from({ length: byes }, (_, k) => Math.floor((k * half) / byes)));
  const firstRound: BracketSlot[] = [];
  let i = 0;
  for (let slot = 0; slot < half; slot++) {
    if (byeSlots.has(slot)) firstRound.push({ round: 1, slot, home: drawOrder[i++], away: null });
    else firstRound.push({ round: 1, slot, home: drawOrder[i++], away: drawOrder[i++] });
  }
  const all = [...firstRound];
  for (let round = 2, matches = size / 4; matches >= 1; round++, matches /= 2) {
    for (let slot = 0; slot < matches; slot++) all.push({ round, slot, home: null, away: null });
  }
  return all;
}

/** Match du tour suivant alimenté par ce match, et le côté (domicile pour un créneau pair). */
export const nextSlot = (round: number, slot: number) => ({ round: round + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "home" : "away" }) as const;

export const roundCount = (teams: number) => Math.log2(nextPowerOfTwo(teams));

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Finale";
  if (fromEnd === 1) return "Demi-finales";
  if (fromEnd === 2) return "Quarts de finale";
  if (fromEnd === 3) return "Huitièmes de finale";
  return `${round}e tour`;
}

/**
 * Vainqueur d'un match à élimination directe : au score, puis aux tirs au but.
 * Exempt (un seul adversaire) : qualifié d'office.
 */
export function knockoutWinner(m: {
  homeClubId: number | null;
  awayClubId: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
}): number | null {
  if (m.homeClubId !== null && m.awayClubId === null) return m.homeClubId;
  if (m.homeClubId === null || m.awayClubId === null || m.homeScore === null || m.awayScore === null) return null;
  if (m.homeScore !== m.awayScore) return m.homeScore > m.awayScore ? m.homeClubId : m.awayClubId;
  if (m.homePenalties === null || m.awayPenalties === null || m.homePenalties === m.awayPenalties) return null;
  return m.homePenalties > m.awayPenalties ? m.homeClubId : m.awayClubId;
}

/** Tirage au sort : mélange de Fisher-Yates avec une source d'aléa fournie (cryptographique en production). */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Compositions d'équipe (EF-CMP-07) ───────────────────────────────────────

export const STARTERS = 11;
export const MAX_SUBSTITUTES = 9;

export type LineupEntry = { playerId: number; starter: boolean; shirtNumber: number | null };

/**
 * Contrôles d'une feuille de composition : 11 titulaires, au plus 9 remplaçants,
 * numéros de 1 à 99 uniques, joueurs licenciés (licence validée de la saison pour ce club),
 * dépôt avant le coup d'envoi.
 */
export function lineupError(entries: LineupEntry[], ctx: { eligible: Set<number>; kickoffAt: Date | null; now?: Date }): string | null {
  const now = ctx.now ?? new Date();
  if (ctx.kickoffAt && ctx.kickoffAt.getTime() <= now.getTime()) return "Le match a commencé : la composition ne peut plus être modifiée.";
  const starters = entries.filter((e) => e.starter).length;
  const subs = entries.length - starters;
  if (starters !== STARTERS) return `Il faut exactement ${STARTERS} titulaires (${starters} sélectionné(s)).`;
  if (subs > MAX_SUBSTITUTES) return `Au plus ${MAX_SUBSTITUTES} remplaçants (${subs} sélectionné(s)).`;
  if (new Set(entries.map((e) => e.playerId)).size !== entries.length) return "Un joueur figure deux fois.";
  const notEligible = entries.filter((e) => !ctx.eligible.has(e.playerId));
  if (notEligible.length > 0) return `${notEligible.length} joueur(s) sans licence validée pour ce club cette saison.`;
  const numbers = entries.map((e) => e.shirtNumber).filter((n): n is number => n !== null);
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) return "Numéros de maillot entre 1 et 99.";
  if (new Set(numbers).size !== numbers.length) return "Deux joueurs ont le même numéro.";
  return null;
}

/**
 * Nom d'une division nationale à partir du championnat : « Ligue 2 » → « Ligue 2 National » ;
 * un nom déjà officiel (« Direct Ligue 1 », « … National ») est gardé tel quel.
 */
export const divisionName = (championshipName: string) => (/\b(national|direct)\b/i.test(championshipName) ? championshipName : `${championshipName} National`);
