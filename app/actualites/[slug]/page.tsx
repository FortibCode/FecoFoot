import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { ARTICLE_CATEGORY_LABELS, ARTICLE_CATEGORY_SLUGS, coverUrl, renderRichText } from "@/lib/articles";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { appUrl } from "@/lib/qr";

async function load(slug: string) {
  const [a] = await db.select().from(articles).where(and(eq(articles.slug, slug), eq(articles.status, "PUBLISHED"))).limit(1);
  return a ?? null;
}

/** Titre, description et image pour les moteurs de recherche et le partage (EF-PUB-08). */
export async function generateMetadata({ params }: PageProps<"/actualites/[slug]">): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return {};
  const cover = coverUrl(a);
  return {
    title: `${a.title} — FECOFOOT`,
    description: a.summary,
    openGraph: {
      type: "article",
      title: a.title,
      description: a.summary,
      publishedTime: a.publishedAt?.toISOString(),
      url: await appUrl(`/actualites/${a.slug}`),
      ...(cover && { images: [await appUrl(cover)] }),
    },
  };
}

/** Page article avec visuel (EF-PUB-02). */
export default async function ArticlePage({ params }: PageProps<"/actualites/[slug]">) {
  const a = await load((await params).slug);
  if (!a) notFound();
  const cover = coverUrl(a);
  return (
    <PublicShell eyebrow={`${ARTICLE_CATEGORY_LABELS[a.category]} · ${formatDate(a.publishedAt)}`} subtitle={`${ARTICLE_CATEGORY_LABELS[a.category]} · ${formatDate(a.publishedAt)}`} title={a.title} wide>
      <article className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-lg text-muted-foreground">{a.summary}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- visuel servi par la route des médias */}
        {cover && <img src={cover} alt="" className="aspect-video w-full rounded-lg object-cover" />}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: renderRichText(a.body) }} />
        <Link href={`/actualites?rubrique=${ARTICLE_CATEGORY_SLUGS[a.category]}`} className="text-sm underline">
          Autres articles : {ARTICLE_CATEGORY_LABELS[a.category]}
        </Link>
      </article>
    </PublicShell>
  );
}
