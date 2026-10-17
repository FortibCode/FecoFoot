/** Discipline (M18, EF-DIS-01) — fichier pur, testé unitairement. */

// ─── Suspensions automatiques (cumul de cartons) ─────────────────────────────

/** Nombre de cartons jaunes (sur des matchs différents) entraînant un match de suspension, par défaut. */
export const DEFAULT_YELLOW_THRESHOLD = 3;

export type CardMatch = {
  id: number;
  kickoffAt: Date | null;
  homeClubId: number | null;
  awayClubId: number | null;
  status: string;
  events: { playerId: number | null; clubId: number; type: string }[];
};

export type AutoSuspension = {
  playerId: number;
  clubId: number;
  fromMatchId: number;
  reason: "RED_CARD" | "TWO_YELLOWS" | "YELLOW_ACCUMULATION";
  matches: number;
  /** Matchs du club (terminés, après la sanction) au cours desquels la suspension a été purgée. */
  servedInMatchIds: number[];
  active: boolean;
};

export const AUTO_REASON_LABELS: Record<AutoSuspension["reason"], string> = {
  RED_CARD: "Carton rouge",
  TWO_YELLOWS: "Deux cartons jaunes dans le même match",
  YELLOW_ACCUMULATION: "Cumul de cartons jaunes",
};

/**
 * Suspensions automatiques d'une compétition, recalculées à partir des feuilles de match :
 * - carton rouge, ou deux jaunes dans le même match : 1 match ;
 * - chaque série de `threshold` jaunes reçus sur des matchs différents : 1 match ;
 * - une suspension est purgée sur les matchs terminés suivants du club du joueur.
 */
export function autoSuspensions(matches: CardMatch[], threshold = DEFAULT_YELLOW_THRESHOLD): AutoSuspension[] {
  const finished = matches.filter((m) => m.status === "FINISHED").sort((a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0) || a.id - b.id);
  const yellowCount = new Map<number, number>();
  const result: AutoSuspension[] = [];

  finished.forEach((m, index) => {
    const byPlayer = new Map<number, { clubId: number; yellow: number; red: number }>();
    for (const e of m.events) {
      if (e.playerId === null || (e.type !== "YELLOW_CARD" && e.type !== "RED_CARD")) continue;
      const p = byPlayer.get(e.playerId) ?? { clubId: e.clubId, yellow: 0, red: 0 };
      if (e.type === "YELLOW_CARD") p.yellow++;
      else p.red++;
      byPlayer.set(e.playerId, p);
    }
    for (const [playerId, p] of byPlayer) {
      let reason: AutoSuspension["reason"] | null = null;
      if (p.red > 0) reason = "RED_CARD";
      else if (p.yellow >= 2) reason = "TWO_YELLOWS";
      else if (p.yellow === 1) {
        const count = (yellowCount.get(playerId) ?? 0) + 1;
        yellowCount.set(playerId, count);
        if (count % threshold === 0) reason = "YELLOW_ACCUMULATION";
      }
      if (!reason) continue;
      const later = finished.slice(index + 1).filter((x) => x.homeClubId === p.clubId || x.awayClubId === p.clubId);
      const servedInMatchIds = later.slice(0, 1).map((x) => x.id);
      result.push({ playerId, clubId: p.clubId, fromMatchId: m.id, reason, matches: 1, servedInMatchIds, active: servedInMatchIds.length < 1 });
    }
  });
  return result;
}

// ─── Dossiers et sanctions de la commission ──────────────────────────────────

export const SANCTION_TYPES = ["WARNING", "MATCH_SUSPENSION", "TIME_SUSPENSION", "FINE", "POINTS_DEDUCTION"] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];
export const SANCTION_LABELS: Record<SanctionType, string> = {
  WARNING: "Avertissement",
  MATCH_SUSPENSION: "Suspension (matchs)",
  TIME_SUSPENSION: "Suspension (durée)",
  FINE: "Amende",
  POINTS_DEDUCTION: "Retrait de points",
};

export const CASE_STATUSES = ["OPEN", "DECIDED", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = { OPEN: "En instruction", DECIDED: "Décision rendue", CLOSED: "Classé sans suite" };

export const formatCaseNumber = (season: number, n: number) => `DIS-${season}-${String(n).padStart(4, "0")}`;

/** Cohérence d'une décision : la sanction doit porter sur la bonne personne et avoir ses paramètres. */
export function decisionError(d: {
  type: SanctionType;
  playerId: number | null;
  clubId: number | null;
  competitionId: number | null;
  suspensionMatches: number | null;
  suspensionUntil: Date | null;
  fineAmount: number | null;
  pointsDeducted: number | null;
  now?: Date;
}): string | null {
  const now = d.now ?? new Date();
  if (d.type === "MATCH_SUSPENSION" || d.type === "TIME_SUSPENSION") {
    if (!d.playerId) return "Une suspension vise un joueur.";
    if (d.type === "MATCH_SUSPENSION" && (!d.suspensionMatches || d.suspensionMatches < 1)) return "Nombre de matchs de suspension requis.";
    if (d.type === "TIME_SUSPENSION" && (!d.suspensionUntil || d.suspensionUntil.getTime() <= now.getTime())) return "Date de fin de suspension future requise.";
  }
  if (d.type === "FINE" && (!d.fineAmount || d.fineAmount <= 0 || !Number.isInteger(d.fineAmount))) return "Montant de l'amende requis (FCFA, entier).";
  if (d.type === "POINTS_DEDUCTION") {
    if (!d.clubId || !d.competitionId) return "Un retrait de points vise un club engagé dans une compétition.";
    if (!d.pointsDeducted || d.pointsDeducted < 1) return "Nombre de points retirés requis.";
  }
  return null;
}

/**
 * Suspension prononcée par la commission encore en cours ?
 * - en matchs : purgée sur les matchs terminés du club joués après la décision ;
 * - en durée : jusqu'à la date fixée.
 */
export function caseSuspensionActive(
  c: { type: SanctionType; suspensionMatches: number | null; suspensionUntil: Date | null },
  clubMatchesPlayedSinceDecision: number,
  now: Date = new Date(),
): boolean {
  if (c.type === "MATCH_SUSPENSION") return clubMatchesPlayedSinceDecision < (c.suspensionMatches ?? 0);
  if (c.type === "TIME_SUSPENSION") return c.suspensionUntil !== null && c.suspensionUntil.getTime() > now.getTime();
  return false;
}
