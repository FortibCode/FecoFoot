import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ClubLogo } from "@/components/public/club-logo";
import { ArrowIcon, PinIcon, SearchIcon, ShieldIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { SectionTitle } from "@/components/public/section-title";
import { clubLogos } from "@/lib/club-logos";
import { db } from "@/lib/db";
import { clubs } from "@/lib/db/schema";
import { textMatch } from "@/lib/text-search";

export const metadata: Metadata = { title: "Clubs affiliés — FECOFOOT", description: "Les clubs affiliés à la Fédération Congolaise de Football, par ville." };

const UNKNOWN_CITY = /^(à|a) préciser$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Clubs affiliés par ville, avec recherche et accès par ville (EF-PUB-04). */
export default async function PublicClubsPage({ searchParams }: PageProps<"/clubs">) {
  await connection();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 60);
  const cityFilter = one(sp.ville);
  const all = await db.select().from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.city), asc(clubs.name));
  const logos = await clubLogos(all.map((c) => c.id));
  // Villes connues par ordre alphabétique, la ville « à préciser » en dernier.
  const cityName = (c: string) => (UNKNOWN_CITY.test(c) ? "Ville à préciser" : c);
  const allCities = [...new Set(all.map((c) => cityName(c.city)))].sort((a, b) => Number(a === "Ville à préciser") - Number(b === "Ville à préciser") || a.localeCompare(b, "fr"));
  const rows = all.filter((c) => textMatch(q ?? "", c.name, c.shortName, c.city, c.stadium) && (!cityFilter || cityName(c.city) === cityFilter));
  const cities = allCities.filter((city) => rows.some((c) => cityName(c.city) === city));
  const href = (ville?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (ville) p.set("ville", ville);
    const s = p.toString();
    return `/clubs${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:border-[var(--flag-green)] hover:text-[var(--flag-green)]"}`;

  return (
    <PublicShell eyebrow="Clubs" title="Clubs affiliés" subtitle="Les clubs affiliés à la Fédération Congolaise de Football : fiche, stade, compétitions et résultats." wide>
      <div className="flex flex-col gap-10">
        {/* Chiffres et recherche */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-3">
              {(
                [
                  [all.length, all.length > 1 ? "clubs affiliés" : "club affilié"],
                  [allCities.filter((c) => c !== "Ville à préciser").length, "villes"],
                ] as const
              ).map(([n, label], i) => (
                <div key={label} data-reveal="left" style={{ ["--rd" as string]: `${i * 120}ms` }} className="flex items-baseline gap-2 bg-muted/60 px-5 py-3">
                  <strong className="font-display text-3xl leading-none font-bold tabular-nums">{n}</strong>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <form role="search" data-reveal="right" className="flex w-full gap-2 sm:w-auto">
              {cityFilter && <input type="hidden" name="ville" value={cityFilter} />}
              <label className="relative flex min-w-0 flex-1 items-center sm:w-72 sm:flex-none">
                <span className="sr-only">Rechercher un club</span>
                <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                <input name="q" defaultValue={q} placeholder="Club, ville, stade…" className="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm transition-[border-color,box-shadow] focus:border-[var(--flag-green)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--flag-green)_20%,transparent)] focus:outline-none" />
              </label>
              <button type="submit" className="h-10 rounded-md bg-brand-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--flag-green)]">
                Rechercher
              </button>
            </form>
          </div>
          {allCities.length > 1 && (
            <nav aria-label="Villes" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <ul className="flex gap-2 sm:flex-wrap">
                <li>
                  <Link href={href()} aria-current={!cityFilter ? "page" : undefined} className={chip(!cityFilter)}>
                    Toutes les villes
                  </Link>
                </li>
                {allCities.map((city) => (
                  <li key={city}>
                    <Link href={href(city)} aria-current={cityFilter === city ? "page" : undefined} className={chip(cityFilter === city)}>
                      <PinIcon className="size-3.5" />
                      {city}
                      <span className={`rounded-full px-1.5 text-xs tabular-nums ${cityFilter === city ? "bg-white/20" : "bg-muted"}`}>{all.filter((c) => cityName(c.city) === city).length}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        {cities.length === 0 ? (
          <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
            <ShieldIcon className="size-9 text-[var(--flag-green)]" />
            <p className="font-semibold">{all.length === 0 ? "Aucun club affilié pour le moment." : "Aucun club ne correspond à votre recherche."}</p>
            {all.length > 0 && (
              <Link href="/clubs" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                Voir tous les clubs
              </Link>
            )}
          </div>
        ) : (
          cities.map((city) => {
            const list = rows.filter((c) => cityName(c.city) === city);
            return (
              <section key={city} aria-label={city} className="flex flex-col gap-5">
                <SectionTitle icon={<PinIcon className="size-5" />} title={city} text={`${list.length} club${list.length > 1 ? "s" : ""} affilié${list.length > 1 ? "s" : ""}`} />
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((c, i) => (
                    <li key={c.id} data-reveal="up" style={{ ["--rd" as string]: `${Math.min(i, 8) * 60}ms` }}>
                      <Link
                        href={`/clubs/${c.slug}`}
                        className="group relative flex h-full flex-col items-center gap-3 overflow-hidden bg-muted/60 px-4 pt-6 pb-5 text-center transition-[background-color,transform,box-shadow] duration-300 ease-out hover:bg-muted hover:shadow-[0_18px_36px_-22px_rgb(0_0_0/0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-1"
                      >
                        {/* Filet tricolore qui se déploie au survol. */}
                        <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
                        <span className="relative size-24 shrink-0 bg-card sm:size-28">
                          {/* Logo contenu dans sa tuile (taille fixe), quel que soit son format. */}
                          <ClubLogo src={logos.get(c.id)} name={c.name} className="absolute inset-0 m-auto size-[84%] transition-transform duration-500 ease-out motion-safe:group-hover:scale-105" />
                        </span>
                        <span className="font-display text-lg leading-tight font-bold uppercase">{c.name}</span>
                        {(c.stadium || c.foundedYear) && <span className="text-xs text-muted-foreground">{[c.stadium, c.foundedYear && `Fondé en ${c.foundedYear}`].filter(Boolean).join(" · ")}</span>}
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-[var(--flag-green)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                          Voir le club
                          <ArrowIcon className="size-3.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </PublicShell>
  );
}
