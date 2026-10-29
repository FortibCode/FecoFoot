/** Instances et commissions de la fédération (gouvernance) — fichier pur, testé unitairement. */

export const GOVERNANCE_BODY_KINDS = ["EXECUTIVE", "GENERAL_ASSEMBLY", "JUDICIAL", "PERMANENT", "INDEPENDENT", "OTHER"] as const;
export type GovernanceBodyKind = (typeof GOVERNANCE_BODY_KINDS)[number];
export const GOVERNANCE_BODY_KIND_LABELS: Record<GovernanceBodyKind, string> = {
  EXECUTIVE: "Comité exécutif",
  GENERAL_ASSEMBLY: "Assemblée générale",
  JUDICIAL: "Commission juridictionnelle",
  PERMANENT: "Commission permanente",
  INDEPENDENT: "Commission indépendante",
  OTHER: "Autre instance",
};

/**
 * Rang d'une fonction pour l'ordre d'affichage : président, vice-président(s), secrétaire,
 * trésorier, puis membres. Déduit du libellé saisi (« 1er vice-président », « Membre »…).
 */
export function positionRank(position: string): number {
  const p = position
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/vice[- ]?president/.test(p)) return 1;
  if (/president/.test(p)) return 0;
  if (/secretaire/.test(p)) return 2;
  if (/tresorier/.test(p)) return 3;
  if (/rapporteur/.test(p)) return 4;
  return 9;
}

/** Membres en fonction triés par rang, puis par nom. */
export function sortMembers<T extends { position: string; fullName: string }>(members: T[]): T[] {
  return [...members].sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.fullName.localeCompare(b.fullName, "fr"));
}
