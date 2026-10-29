import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  ARTICLE_CATEGORY_LABELS,
  coverUrl,
  type ArticleCategory,
} from "@/lib/articles";
import { formatDate } from "@/lib/format";

/** Vignette d'article (liste des actualités, page d'accueil). */
export function ArticleCard({
  a,
}: {
  a: {
    id: number;
    slug: string;
    title: string;
    summary: string;
    category: ArticleCategory;
    publishedAt: Date | null;
    coverKey: string | null;
  };
}) {
  const cover = coverUrl(a);
  return (
    <Link
      href={`/actualites/${a.slug}`}
      className="group flex h-full flex-col gap-2 overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- visuel servi par la route des médias
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
        />
      ) : (
        <div className="brand-band flex aspect-video w-full items-center justify-center">
          <BrandLogo size={72} decorative className="opacity-90" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--flag-green)]">
          {ARTICLE_CATEGORY_LABELS[a.category]} · {formatDate(a.publishedAt)}
        </p>
        <p className="font-heading text-xl font-semibold leading-tight group-hover:text-primary">
          {a.title}
        </p>
        <p className="text-sm text-muted-foreground">{a.summary}</p>
      </div>
    </Link>
  );
}
