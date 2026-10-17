/** Actualités et communiqués (M14) — fichier pur, testé unitairement. EF-COM-01, EF-COM-02, EF-PUB-02. */

export const ARTICLE_CATEGORIES = ["COMMUNIQUE", "NATIONAL_TEAMS", "COMPETITIONS", "CLUBS", "REFEREEING", "INSTITUTION", "TECHNICAL"] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  COMMUNIQUE: "Communiqués",
  NATIONAL_TEAMS: "Équipes nationales",
  COMPETITIONS: "Compétitions",
  CLUBS: "Clubs",
  REFEREEING: "Arbitrage",
  INSTITUTION: "Fédération",
  TECHNICAL: "DTN et formation",
};
/** Rubrique dans l'URL publique (?rubrique=…). */
export const ARTICLE_CATEGORY_SLUGS: Record<ArticleCategory, string> = {
  COMMUNIQUE: "communiques",
  NATIONAL_TEAMS: "equipes-nationales",
  COMPETITIONS: "competitions",
  CLUBS: "clubs",
  REFEREEING: "arbitrage",
  INSTITUTION: "federation",
  TECHNICAL: "dtn-formation",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Mise en forme d'une ligne déjà échappée : liens http(s), gras, italique. */
function inline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text: string, url: string) => `<a href="${url}" rel="noopener nofollow" target="_blank">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

/**
 * Texte enrichi des articles (EF-COM-02), syntaxe simple et sûre :
 *   ## Intertitre · **gras** · *italique* · [texte](https://lien) · lignes « - » en liste · ligne vide = paragraphe.
 * Tout le texte est échappé AVANT la mise en forme : aucune balise ni script saisi ne passe ;
 * seuls les liens http(s) sont acceptés (pas de javascript:).
 */
export function renderRichText(source: string): string {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((l) => escapeHtml(l.trim()));
      if (lines.length === 1 && lines[0].startsWith("## ")) return `<h2>${inline(lines[0].slice(3))}</h2>`;
      if (lines.every((l) => l.startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

/** Texte brut (extrait, description pour le référencement). */
export function plainText(source: string, max = 200): string {
  const text = source
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*]/g, "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Adresse publique du visuel ; le suffixe change avec l'image, ce qui permet une mise en cache longue. */
export const coverUrl = (a: { id: number; coverKey: string | null }) => (a.coverKey ? `/media/actualites/${a.id}?v=${a.coverKey.slice(-12, -5)}` : null);
