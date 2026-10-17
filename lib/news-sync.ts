import "server-only";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { MIME, sniffKind } from "@/lib/documents";
import { slugify } from "@/lib/format";
import { putFile } from "@/lib/storage";
import { htmlToPlain, htmlToRichText, mapCategory, summaryFrom } from "@/lib/wp-import";

/**
 * Synchronisation des actualités avec l'ancien site WordPress (fecofoot.cg).
 * Les articles sont enregistrés en base comme ceux saisis dans l'espace fédéral : ils se modifient,
 * se retirent ou se republient depuis Administration › Actualités. Un article déjà repris (même
 * adresse d'origine) n'est jamais réimporté : les modifications faites ici ne sont pas écrasées.
 */
export const WP_SITE = process.env.WP_SOURCE_URL ?? "https://fecofoot.cg";
const PER_PAGE = 20;
/** Visuels un peu plus lourds acceptés que pour un téléversement manuel (photos 2000 px de l'ancien site). */
const MAX_COVER_BYTES = 10 * 1024 * 1024;

type WpPost = {
  id: number;
  date_gmt: string;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  _embedded?: { "wp:featuredmedia"?: { source_url?: string }[] };
};

async function getJson<T>(path: string): Promise<{ data: T; totalPages: number }> {
  const res = await fetch(`${WP_SITE}/wp-json/wp/v2/${path}`, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`fecofoot.cg a répondu ${res.status} pour ${path}`);
  return { data: (await res.json()) as T, totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1) };
}

async function categorySlugs(): Promise<Map<number, string>> {
  const { data } = await getJson<{ id: number; slug: string }[]>("categories?per_page=100&_fields=id,slug");
  return new Map(data.map((c) => [c.id, c.slug]));
}

/** Visuel de couverture téléchargé dans notre stockage ; null si absent, trop lourd ou d'un format refusé. */
async function downloadCover(url: string, articleId: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return null;
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf") return null;
  const key = `article/${articleId}/${randomUUID()}.${kind}`;
  await putFile(key, bytes);
  return { coverKey: key, coverType: MIME[kind] };
}

async function uniqueSlug(base: string, wpId: number) {
  const slug = (base || `article-${wpId}`).slice(0, 180);
  const [taken] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1);
  return taken ? `${slug.slice(0, 170)}-${wpId}` : slug;
}

async function importPost(post: WpPost, cats: Map<number, string>) {
  const title = htmlToPlain(post.title.rendered).slice(0, 200);
  const body = htmlToRichText(post.content.rendered);
  const [created] = await db
    .insert(articles)
    .values({
      slug: await uniqueSlug(slugify(decodeURIComponent(post.slug)) || slugify(title), post.id),
      title,
      summary: summaryFrom(post.excerpt.rendered, post.content.rendered) || title,
      body: body || summaryFrom(post.excerpt.rendered, title),
      category: mapCategory(post.categories.map((c) => cats.get(c) ?? "")),
      status: "PUBLISHED",
      publishedAt: new Date(`${post.date_gmt}Z`),
      sourceUrl: post.link,
    })
    .onConflictDoNothing({ target: articles.sourceUrl })
    .returning({ id: articles.id });
  if (!created) return false;
  const media = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  if (media) {
    const cover = await downloadCover(media, created.id).catch(() => null);
    if (cover) await db.update(articles).set(cover).where(eq(articles.id, created.id));
  }
  return true;
}

export type SyncReport = { imported: number; skipped: number; failed: string[] };

/**
 * `all` : reprend tout l'historique. `new` : s'arrête dès qu'une page ne contient plus rien de nouveau
 * (les articles sont servis du plus récent au plus ancien).
 */
export async function syncNews({ mode, maxPages = 100, onProgress }: { mode: "all" | "new"; maxPages?: number; onProgress?: (msg: string) => void }): Promise<SyncReport> {
  const cats = await categorySlugs();
  const report: SyncReport = { imported: 0, skipped: 0, failed: [] };
  for (let page = 1; page <= maxPages; page++) {
    const { data: posts, totalPages } = await getJson<WpPost[]>(`posts?per_page=${PER_PAGE}&page=${page}&_embed=wp:featuredmedia&orderby=date&order=desc`);
    const known = new Set(
      posts.length
        ? (await db.select({ u: articles.sourceUrl }).from(articles).where(inArray(articles.sourceUrl, posts.map((p) => p.link)))).map((r) => r.u)
        : [],
    );
    let fresh = 0;
    for (const post of posts) {
      if (known.has(post.link)) {
        report.skipped++;
        continue;
      }
      try {
        if (await importPost(post, cats)) {
          report.imported++;
          fresh++;
        } else report.skipped++;
      } catch (e) {
        report.failed.push(`${htmlToPlain(post.title.rendered)} : ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    onProgress?.(`page ${page}/${totalPages} : ${fresh} nouveau(x)`);
    if (page >= totalPages || (mode === "new" && fresh === 0)) break;
  }
  return report;
}
