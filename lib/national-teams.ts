/** Équipes nationales (M09) — EF-SEL-01 à 05. */

export const NATIONAL_TEAMS = [
  { code: "A", name: "Diables Rouges A", slug: "a", gender: "M" },
  { code: "A_LOCAL", name: "Diables Rouges A' (locaux)", slug: "a-locaux", gender: "M" },
  { code: "U23", name: "Diables Rouges U-23", slug: "u23", gender: "M" },
  { code: "U20", name: "Diables Rouges U-20", slug: "u20", gender: "M" },
  { code: "U17", name: "Diables Rouges U-17", slug: "u17", gender: "M" },
  { code: "U15", name: "Diables Rouges U-15", slug: "u15", gender: "M" },
  { code: "WOMEN", name: "Diables Rouges Dames", slug: "dames", gender: "F" },
] as const;

/** Ce que désigne chaque sélection (cartes du portail). */
export const NATIONAL_TEAM_TAGLINES: Record<string, string> = {
  a: "Équipe première",
  "a-locaux": "Joueurs du championnat national",
  u23: "Moins de 23 ans",
  u20: "Moins de 20 ans",
  u17: "Moins de 17 ans",
  u15: "Moins de 15 ans",
  dames: "Équipe féminine",
};

/** Repère court de chaque sélection (visuel des cartes sans photo). */
export const NATIONAL_TEAM_SHORT: Record<string, string> = { a: "A", "a-locaux": "A'", u23: "U-23", u20: "U-20", u17: "U-17", u15: "U-15", dames: "Dames" };

export const NATIONAL_TEAM_CODES = NATIONAL_TEAMS.map((t) => t.code) as unknown as readonly [string, ...string[]];

export const SELECTION_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const SELECTION_STATUS_LABELS = { DRAFT: "Brouillon", PUBLISHED: "Publiée" } as const;

export const FIXTURE_STATUSES = ["SCHEDULED", "PLAYED", "CANCELLED"] as const;
export type FixtureStatus = (typeof FIXTURE_STATUSES)[number];
export const FIXTURE_STATUS_LABELS: Record<FixtureStatus, string> = { SCHEDULED: "À venir", PLAYED: "Joué", CANCELLED: "Annulé" };

/** Un convoqué est soit un joueur du registre national, soit un joueur évoluant à l'étranger (EF-SEL-02). */
export function calledPlayerError(p: { playerId: number | null; externalName: string | null; externalClub: string | null; externalCountry: string | null }): string | null {
  if (p.playerId !== null) return p.externalName ? "Choisissez un joueur du registre OU un joueur de l'étranger, pas les deux." : null;
  if (!p.externalName || p.externalName.trim().length < 3) return "Nom du joueur requis.";
  if (!p.externalClub || !p.externalCountry) return "Club et pays requis pour un joueur évoluant à l'étranger.";
  return null;
}

/** Numéros de maillot : 1 à 99, uniques dans une liste. */
export function shirtNumberError(number: number | null, taken: number[]): string | null {
  if (number === null) return null;
  if (!Number.isInteger(number) || number < 1 || number > 99) return "Numéro entre 1 et 99.";
  if (taken.includes(number)) return `Le numéro ${number} est déjà attribué.`;
  return null;
}
