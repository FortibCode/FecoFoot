/** Arbitrage (M08) — fichier pur, testé unitairement. EF-ARB-01 à 03, RG-08. */

export const REFEREE_GRADES = ["FIFA", "ELITE", "NATIONAL", "LEAGUE", "TRAINEE"] as const;
export type RefereeGrade = (typeof REFEREE_GRADES)[number];
export const REFEREE_GRADE_LABELS: Record<RefereeGrade, string> = {
  FIFA: "International FIFA",
  ELITE: "Élite",
  NATIONAL: "National",
  LEAGUE: "Ligue",
  TRAINEE: "Stagiaire",
};

export const OFFICIAL_ROLES = ["REFEREE", "ASSISTANT_1", "ASSISTANT_2", "FOURTH_OFFICIAL", "COMMISSIONER"] as const;
export type OfficialRole = (typeof OFFICIAL_ROLES)[number];
export const OFFICIAL_ROLE_LABELS: Record<OfficialRole, string> = {
  REFEREE: "Arbitre central",
  ASSISTANT_1: "Assistant 1",
  ASSISTANT_2: "Assistant 2",
  FOURTH_OFFICIAL: "4e arbitre",
  COMMISSIONER: "Commissaire",
};

/** Jour du match à Brazzaville (UTC+1) : base du contrôle « pas deux matchs le même jour ». */
export const matchDay = (kickoffAt: Date) => new Date(kickoffAt.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

export type Designation = { matchId: number; refereeId: number; role: OfficialRole; day: string };

/** Contrôles de désignation (EF-ARB-03, RG-08), avant l'écriture en base (qui les garantit aussi). */
export function designationError(next: Designation, existing: Designation[]): string | null {
  const others = existing.filter((d) => !(d.matchId === next.matchId && d.role === next.role));
  if (others.some((d) => d.matchId === next.matchId && d.refereeId === next.refereeId)) {
    return "Cet officiel occupe déjà une autre fonction sur ce match.";
  }
  if (others.some((d) => d.refereeId === next.refereeId && d.day === next.day && d.matchId !== next.matchId)) {
    return "Cet officiel est déjà désigné sur un autre match le même jour.";
  }
  return null;
}
