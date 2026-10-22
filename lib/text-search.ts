/** Texte comparable : minuscules, sans accents (« Léopards » ↔ « leopards »). */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Vrai si la recherche `q` (vide : tout) apparaît dans l'un des champs, sans tenir compte des accents ni de la casse. */
export function textMatch(q: string | undefined, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = fold(q.trim());
  return fields.some((f) => f && fold(f).includes(needle));
}
