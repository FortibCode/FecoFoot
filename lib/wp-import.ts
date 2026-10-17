/**
 * Reprise des articles de l'ancien site WordPress fecofoot.cg — fichier pur, testé unitairement.
 * Le HTML de WordPress est converti dans la syntaxe simple et sûre des actualités (lib/articles.ts).
 */
import type { ArticleCategory } from "@/lib/articles";

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à",
  acirc: "â", ccedil: "ç", ocirc: "ô", icirc: "î", ucirc: "û", ugrave: "ù", euro: "€", deg: "°", trade: "™", copy: "©",
};

/** Entités HTML (&rsquo;, &#8217;, &#x2019;…) en caractères. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Texte brut d'un fragment HTML (titres, extraits). */
export function htmlToPlain(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Mise en forme en ligne : gras, italique, liens http(s) ; toute autre balise est retirée. */
function inline(html: string): string {
  const out = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url: string, text: string) => {
      const t = htmlToPlain(text);
      return t ? `[${t.replace(/[[\]]/g, "")}](${decodeEntities(url)})` : "";
    })
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => {
      const t = inner.replace(/<[^>]+>/g, "").trim();
      return t ? `**${t}**` : "";
    })
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => {
      const t = inner.replace(/<[^>]+>/g, "").trim();
      return t ? `*${t}*` : "";
    })
    .replace(/<[^>]+>/g, "");
  return decodeEntities(out)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .trim();
}

/**
 * Corps d'article : paragraphes, intertitres (h2 à h4 → « ## »), listes (« - »).
 * Les images, vidéos et embarquements sont ignorés (l'image principale devient le visuel de couverture).
 */
export function htmlToRichText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|figure|iframe|video|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<img\b[^>]*>/gi, "");
  const blocks: string[] = [];
  const re = /<(h[1-6]|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of cleaned.matchAll(re)) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => inline(li[1]).replace(/\n+/g, " ")).filter(Boolean);
      if (items.length) blocks.push(items.map((i) => `- ${i}`).join("\n"));
    } else if (tag.startsWith("h")) {
      const t = htmlToPlain(inner);
      if (t) blocks.push(`## ${t}`);
    } else {
      const t = inline(inner);
      if (t) blocks.push(t);
    }
  }
  return blocks.join("\n\n");
}

/** Rubrique d'après les catégories WordPress (slugs) ; la plus spécifique l'emporte. */
export function mapCategory(slugs: string[]): ArticleCategory {
  const has = (...s: string[]) => s.some((x) => slugs.includes(x));
  if (has("corps-arbitrage")) return "REFEREEING";
  if (has("infos-dtn", "formations")) return "TECHNICAL";
  if (has("competions-nationales", "informations-sur-la-ligue-nationale-de-football-congolais")) return "COMPETITIONS";
  if (has("communiques", "urgent")) return "COMMUNIQUE";
  return "INSTITUTION";
}

/** Chapô : extrait WordPress en texte brut, sans le « […] » final, 400 caractères au plus. */
export function summaryFrom(excerptHtml: string, fallback: string): string {
  const text = (htmlToPlain(excerptHtml) || htmlToPlain(fallback)).replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, "…");
  return text.length <= 400 ? text : `${text.slice(0, 399).trimEnd()}…`;
}
