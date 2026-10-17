import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ARTICLE_CATEGORY_LABELS, coverUrl, type ArticleCategory } from "@/lib/articles";

export type NewsItem = { id: number; slug: string; title: string; category: ArticleCategory; publishedAt: Date | null; coverKey: string | null };

const dayMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit" });

function Cover({ a, className = "" }: { a: NewsItem; className?: string }) {
  const src = coverUrl(a);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- visuel servi par la route des médias
    <img src={src} alt="" loading="lazy" className={`object-cover ${className}`} />
  ) : (
    <span className={`brand-band flex items-center justify-center ${className}`}>
      <BrandLogo size={64} decorative className="w-1/4 max-w-16 opacity-80" />
    </span>
  );
}

/** Grande vignette : photo pleine, rubrique en étiquette et titre sur un dégradé sombre. */
function Tile({ a, className = "", index = 0 }: { a: NewsItem; className?: string; index?: number }) {
  return (
    <li data-reveal="up" style={{ ["--rd" as string]: `${index * 110}ms` }} className={`min-h-60 ${className}`}>
      <Link href={`/actualites/${a.slug}`} className="group relative flex h-full overflow-hidden rounded-xl bg-brand-ink shadow-sm">
        <Cover a={a} className="absolute inset-0 size-full transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(0_0_0/0.82)_100%)]" />
        <span className="relative mt-auto flex flex-col items-start gap-2.5 p-5">
          <span className="rounded bg-primary px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white">{ARTICLE_CATEGORY_LABELS[a.category]}</span>
          <span className="line-clamp-3 text-lg leading-snug font-bold break-words text-white sm:text-xl">{a.title}</span>
        </span>
      </Link>
    </li>
  );
}

/** Fil d'infos : date, rubrique, titre et vignette. */
function Feed({ items }: { items: NewsItem[] }) {
  return (
    <aside data-reveal="right" style={{ ["--rd" as string]: "200ms" }} aria-labelledby="fil-infos" className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-muted lg:h-full">
      <h3 id="fil-infos" className="px-5 pt-6 pb-2 font-heading text-2xl font-bold tracking-wide uppercase">
        Fil d&apos;infos
      </h3>
      <ul className="min-h-0 flex-1 overflow-y-auto px-5 [scrollbar-width:thin]">
        {items.map((a) => (
          <li key={a.id} className="border-b border-foreground/10 last:border-b-0">
            <Link href={`/actualites/${a.slug}`} className="group flex items-start gap-3 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-xs font-bold">
                  {a.publishedAt && <time dateTime={a.publishedAt.toISOString()}>{dayMonth.format(a.publishedAt)}</time>}
                  <span className="truncate uppercase text-[var(--flag-green)]">{ARTICLE_CATEGORY_LABELS[a.category]}</span>
                </span>
                <span className="mt-1 line-clamp-2 text-sm leading-snug font-semibold break-words group-hover:text-primary">{a.title}</span>
              </span>
              <Cover a={a} className="size-16 shrink-0 rounded-md" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/actualites" className="group flex items-center justify-between border-t border-foreground/10 px-5 py-3.5 text-sm font-semibold hover:text-primary">
        Voir toutes les actualités
        <span aria-hidden className="text-lg text-[var(--flag-green)] transition-transform group-hover:translate-x-1">⟶</span>
      </Link>
    </aside>
  );
}

/**
 * Mosaïque des actualités : quatre grandes vignettes en quinconce (grande, petite / petite, grande)
 * et le fil d'infos à droite. Sur téléphone, les vignettes s'empilent et le fil suit.
 */
export function NewsMosaic({ items }: { items: NewsItem[] }) {
  const [a, b, c, d, ...rest] = items;
  const tiles = [a, b, c, d].filter(Boolean);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-stretch">
      <ul className="grid auto-rows-[15rem] gap-5 sm:grid-cols-3 lg:auto-rows-[17.5rem]">
        {tiles.map((t, i) => (
          <Tile key={t.id} a={t} index={i} className={i === 0 || i === 3 ? "sm:col-span-2" : ""} />
        ))}
      </ul>
      {rest.length > 0 && (
        <div className="relative lg:h-auto">
          <div className="lg:absolute lg:inset-0">
            <Feed items={rest} />
          </div>
        </div>
      )}
    </div>
  );
}
