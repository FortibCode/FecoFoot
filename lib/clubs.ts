/** Règles et libellés du module Ligues et clubs (M03). */

export const CLUB_STATUSES = ["PENDING", "AFFILIATED", "SUSPENDED", "STRUCK_OFF"] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];

export const CLUB_STATUS_LABELS: Record<ClubStatus, string> = {
  PENDING: "En attente",
  AFFILIATED: "Affilié",
  SUSPENDED: "Suspendu",
  STRUCK_OFF: "Radié",
};

/** Numéro d'affiliation : FCF-CLB-0001 (EF-CLB-02). */
export function formatAffiliationNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Numéro de séquence invalide : ${n}`);
  return `FCF-CLB-${String(n).padStart(4, "0")}`;
}
