import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { ArticleCard } from "@/components/public/article-card";
import { NewsMosaic } from "@/components/public/news-mosaic";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, ARTICLE_CATEGORY_SLUGS } from "@/lib/articles";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";

const PAGE_SIZE = 24;
const FIRST_PAGE = 9 + PAGE_SIZE;

export const metadata: Metadata = { title: "Actualités — FECOFOOT", description: "Actualités et communiqués de la Fédération Congolaise de Football." };

/** Actualités filtrables par rubrique (EF-PUB-02). */
export default async function NewsPage({ searchParams }: PageProps<"/actualites">) {
  await connection();
  const raw = (await searchParams).rubrique;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const category = ARTICLE_CATEGORIES.find((c) => ARTICLE_CATEGORY_SLUGS[c] === slug);
  const rawPage = (await searchParams).page;
  const page = Math.max(1, Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1);
  const where = and(eq(articles.status, "PUBLISHED"), category ? eq(articles.category, category) : undefined);
  // Première page : mosaïque (4 vignettes + fil de 5) puis la grille ; pages suivantes : grille seule.
  const offset = page === 1 ? 0 : FIRST_PAGE + (page - 2) * PAGE_SIZE;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.publishedAt), desc(articles.id))
      .limit(page === 1 ? FIRST_PAGE : PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(articles).where(where),
  ]);
  const pages = total <= FIRST_PAGE ? 1 : 1 + Math.ceil((total - FIRST_PAGE) / PAGE_SIZE);
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (category) q.set("rubrique", ARTICLE_CATEGORY_SLUGS[category]);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/actualites?${qs}` : "/actualites";
  };
  const mosaic = page === 1 && rows.length >= 9 ? rows.slice(0, 9) : [];
  const grid = rows.slice(mosaic.length);

  return (
    <PublicShell eyebrow="Actualités" title={category ? ARTICLE_CATEGORY_LABELS[category] : "Actualités"} wide>
      <nav aria-label="Rubriques" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/actualites" className={`rounded-md border px-3 py-1.5 ${!category ? "bg-foreground text-background" : "hover:bg-muted"}`}>
          Toutes
        </Link>
        {ARTICLE_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/actualites?rubrique=${ARTICLE_CATEGORY_SLUGS[c]}`}
            className={`rounded-md border px-3 py-1.5 ${category === c ? "bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {ARTICLE_CATEGORY_LABELS[c]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Aucun article.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {mosaic.length > 0 && <NewsMosaic items={mosaic} />}
          {grid.length > 0 && (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((a) => (
                <li key={a.id}>
                  <ArticleCard a={a} />
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-4 text-sm">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="rounded-md border px-4 py-2 hover:bg-muted">
                  ← Plus récentes
                </Link>
              )}
              <span className="text-muted-foreground">
                Page {page} / {pages} · {total} article(s)
              </span>
              {page < pages && (
                <Link href={pageHref(page + 1)} className="rounded-md border px-4 py-2 hover:bg-muted">
                  Plus anciennes →
                </Link>
              )}
            </nav>
          )}
        </div>
      )}
    </PublicShell>
  );
}
