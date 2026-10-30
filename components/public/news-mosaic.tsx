import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ARTICLE_CATEGORY_LABELS, coverUrl, type ArticleCategory } from "@/lib/articles";

export type NewsItem = { id: number; slug: string; title: string; category: ArticleCategory; publishedAt: Date | null; coverKey: string | null };

const dayMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit" });
const longDate = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "numeric", month: "long", year: "numeric" });

/**
 * Visuel d'un article. Sans photo : grande vignette aux couleurs de la fédération, écusson en
 * filigrane (un visuel voulu, pas une image manquante) ; petite vignette du fil : écusson seul.
 */
function Cover({ a, className = "", large = false }: { a: NewsItem; className?: string; large?: boolean }) {
  const src = coverUrl(a);
  if (src)
    // Cadrage haut : le titre, posé en bas, masque moins les visages.
    // eslint-disable-next-line @next/next/no-img-element -- visuel servi par la route des médias
    return <img src={src} alt="" loading="lazy" className={`object-cover object-[50%_30%] ${className}`} />;
  return large ? (
    <span className={`brand-band overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel décoratif */}
      <img src="/fecofoot-mark.svg" alt="" className="absolute top-[-8%] right-[-6%] h-[95%] w-auto opacity-[0.12]" />
    </span>
  ) : (
    <span className={`brand-band flex items-center justify-center ${className}`}>
      <BrandLogo size={64} decorative className="w-1/2 max-w-10 opacity-80" />
    </span>
  );
}

/** Grande vignette : photo pleine, rubrique en étiquette et titre sur un dégradé sombre. */
function Tile({ a, className = "", index = 0 }: { a: NewsItem; className?: string; index?: number }) {
  return (
    <li data-reveal="up" style={{ ["--rd" as string]: `${index * 110}ms` }} className={`min-h-60 ${className}`}>
      <Link href={`/actualites/${a.slug}`} className="group relative flex h-full overflow-hidden rounded-xl bg-brand-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green">
        <Cover a={a} large className="absolute inset-0 size-full transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]" />
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(0_0_0/0.55)_62%,rgb(0_0_0/0.9)_100%)]" />
        <span className="relative mt-auto flex flex-col items-start gap-2.5 p-5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="rounded bg-primary px-2 py-1 text-[0.7rem] font-bold whitespace-nowrap uppercase tracking-wide text-white">{ARTICLE_CATEGORY_LABELS[a.category]}</span>
            {a.publishedAt && (
              <time dateTime={a.publishedAt.toISOString()} className="text-xs font-semibold whitespace-nowrap text-white/75">
                {longDate.format(a.publishedAt)}
              </time>
            )}
          </span>
          <span className="line-clamp-3 text-lg leading-snug font-bold break-words text-white sm:text-xl">{a.title}</span>
        </span>
      </Link>
    </li>
  );
}

/** Fil d'infos : date, rubrique, titre et vignette. */
function Feed({ items }: { items: NewsItem[] }) {
  return (
    <aside data-reveal="right" style={{ ["--rd" as string]: "200ms" }} aria-labelledby="fil-infos" className="flex h-full flex-col overflow-hidden rounded-xl bg-muted">
      <h3 id="fil-infos" className="px-5 pt-6 pb-2 font-heading text-2xl font-bold tracking-wide uppercase">
        Fil d&apos;infos
      </h3>
      <ul className="px-5">
        {items.map((a) => (
          <li key={a.id} className="border-b border-foreground/10 last:border-b-0">
            <Link href={`/actualites/${a.slug}`} className="group flex items-start gap-3 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-xs font-bold">
                  {a.publishedAt && <time dateTime={a.publishedAt.toISOString()}>{dayMonth.format(a.publishedAt)}</time>}
                  <span className="truncate uppercase text-[var(--flag-green)]">{ARTICLE_CATEGORY_LABELS[a.category]}</span>
                </span>
                <span className="mt-1 line-clamp-3 text-sm leading-snug font-semibold break-words group-hover:text-primary">{a.title}</span>
              </span>
              <Cover a={a} className="size-14 shrink-0 rounded-md" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/actualites" className="group mt-auto flex items-center justify-between border-t border-foreground/10 px-5 py-3.5 text-sm font-semibold hover:text-primary">
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
      {/* Fil d'infos sans défilement interne : les 4 articles suivants, titres sur 3 lignes au plus. */}
      {rest.length > 0 && <Feed items={rest.slice(0, 4)} />}
    </div>
  );
}
