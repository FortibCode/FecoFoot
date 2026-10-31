import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { ClubLogo } from "@/components/public/club-logo";
import { ArrowIcon, CalendarIcon, GroupIcon, SearchIcon, ShieldIcon, TrophyIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { clubLogos } from "@/lib/club-logos";
import { publicStatusLabel } from "@/lib/competitions";
import { championshipLogoUrl, leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { leaguesOverview, nationalDivisions } from "@/lib/queries/public-leagues";
import { textMatch } from "@/lib/text-search";

export const metadata: Metadata = {
  title: "Ligues départementales — FECOFOOT",
  description: "Les ligues départementales de la Fédération Congolaise de Football et les divisions nationales : clubs, compétitions, calendriers et classements.",
};

/** Couleurs des divisions, par niveau : fond et chevron d'accent aux couleurs du drapeau. */
const DIVISION_THEMES = [
  { bg: "var(--flag-green)", accent: "var(--flag-yellow)" },
  { bg: "var(--brand-ink)", accent: "var(--flag-red)" },
  { bg: "var(--flag-red)", accent: "var(--flag-yellow)" },
];

/** Titre de rubrique : pictogramme dans une pastille, titre, phrase d'explication. */
function SectionTitle({ id, icon, title, text }: { id: string; icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-2xl leading-tight font-bold uppercase sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/** Ligues départementales et divisions nationales (portail). */
export default async function PublicLeaguesPage({ searchParams }: PageProps<"/ligues">) {
  await connection();
  const q = String((await searchParams).q ?? "").trim();
  const [all, divisions] = await Promise.all([leaguesOverview(), nationalDivisions()]);
  const rows = all.filter((l) => textMatch(q, l.name, l.department, l.code));
  const logos = await clubLogos(divisions.flatMap((d) => d.clubs.map((c) => c.id)));

  return (
    <PublicShell eyebrow="Ligues" title="Ligues et divisions" subtitle="Divisions nationales et ligues départementales de la FECOFOOT" wide>
      <div className="flex flex-col gap-14">
        <section className="flex flex-col gap-6" aria-labelledby="divisions">
          <SectionTitle id="divisions" icon={<TrophyIcon className="size-5" />} title="Divisions nationales" text="Les championnats nationaux organisés par la fédération : clubs engagés, calendrier, résultats et classement." />
          {divisions.length === 0 ? (
            <p className="bg-muted/60 p-6 text-muted-foreground">Aucune division nationale publiée pour le moment.</p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {divisions.map(({ c, championship, teams, played, clubs }, i) => {
                const t = DIVISION_THEMES[((championship?.tier ?? i + 1) - 1) % DIVISION_THEMES.length];
                const logo = championship ? championshipLogoUrl(championship) : null;
                const href = championship ? `/championnats/${championship.code}?saison=${c.season}` : `/competitions/${c.slug}`;
                const name = championship?.name ?? c.name;
                return (
                  <li key={c.id} data-reveal="left" style={{ ["--rd" as string]: `${i * 140}ms` }}>
                    <Link
                      href={href}
                      style={{ backgroundColor: t.bg }}
                      className="group relative isolate flex h-full flex-col gap-6 overflow-hidden p-5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green sm:p-7"
                    >
                      {/* Chevron d'accent qui déborde à droite (s'avance au survol). */}
                      <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[14%] transition-transform duration-500 ease-out motion-safe:group-hover:translate-x-2 sm:w-[34%]">
                        <polygon points="70,0 200,0 200,300 70,300 150,150" fill={t.accent} />
                        <polygon points="-30,0 22,0 102,150 22,300 -30,300 50,150" fill={t.accent} opacity="0.35" />
                      </svg>

                      <span className="flex items-center gap-4 sm:gap-5">
                        <span className="grid size-20 shrink-0 place-items-center bg-white p-2 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)] sm:size-24">
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logo officiel servi par la route des médias
                            <img src={logo} alt={`Logo ${name}`} className="size-full object-contain" />
                          ) : (
                            <TrophyIcon className="size-10 text-brand-ink" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-white/75 uppercase">Championnat national</span>
                          <span className="font-display text-2xl leading-none font-bold uppercase sm:text-4xl">{name}</span>
                        </span>
                      </span>

                      <span className="flex max-w-[84%] flex-wrap gap-2 text-xs font-semibold sm:max-w-[70%]">
                        <span className="inline-flex items-center gap-1.5 border border-white/60 px-2.5 py-1">
                          <CalendarIcon className="size-3.5" />
                          Saison {seasonLabel(c.season)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 border border-white/60 px-2.5 py-1">
                          <GroupIcon className="size-3.5" />
                          {teams} club{teams > 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 text-brand-ink">{publicStatusLabel(c.status, played)}</span>
                      </span>

                      {/* Clubs engagés : leurs logos ; sinon la liste reste à publier. */}
                      <span className="mt-auto flex max-w-[84%] flex-col gap-3 sm:max-w-[72%]">
                        {clubs.length > 0 ? (
                          <span className="flex flex-wrap gap-1.5" aria-label={`Clubs engagés : ${clubs.map((k) => k.name).join(", ")}`}>
                            {clubs.slice(0, 12).map((k) => (
                              <span key={k.id} title={k.name} className="grid size-9 place-items-center rounded-full bg-white p-1">
                                <ClubLogo src={logos.get(k.id)} name={k.name} className="size-full text-[0.55rem]" />
                              </span>
                            ))}
                            {clubs.length > 12 && <span className="grid size-9 place-items-center rounded-full bg-white/20 text-xs font-bold">+{clubs.length - 12}</span>}
                          </span>
                        ) : (
                          <span className="text-sm text-white/80">Liste des clubs engagés à publier.</span>
                        )}
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          Voir le championnat
                          <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-6" aria-labelledby="departementales">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle id="departementales" icon={<ShieldIcon className="size-5" />} title="Ligues départementales" text="Les ligues de la fédération dans chaque département : clubs affiliés et compétitions." />
            {all.length > 0 && (
              <form role="search" className="flex w-full gap-2 sm:w-auto">
                <label className="relative flex min-w-0 flex-1 items-center sm:w-72 sm:flex-none">
                  <span className="sr-only">Rechercher une ligue</span>
                  <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                  <input name="q" defaultValue={q} placeholder="Ligue ou département" className="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm" />
                </label>
                <button type="submit" className="h-10 rounded-md bg-brand-ink px-4 text-sm font-semibold text-white">
                  Rechercher
                </button>
              </form>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
              <ShieldIcon className="size-9 text-[var(--flag-green)]" />
              <p className="font-semibold">{q ? `Aucune ligue ne correspond à « ${q} ».` : "Aucune ligue départementale publiée pour le moment."}</p>
              <p className="max-w-md text-sm text-muted-foreground">Les ligues apparaîtront ici dès leur enregistrement par la fédération, avec leurs clubs et leurs compétitions.</p>
              {q && (
                <Link href="/ligues" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                  Voir toutes les ligues
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((l, i) => {
                const logo = leagueLogoUrl(l);
                return (
                  <li key={l.id} data-reveal="left" style={{ ["--rd" as string]: `${Math.min(i, 8) * 60}ms` }}>
                    <Link
                      href={`/ligues/${l.code.toLowerCase()}`}
                      className="group flex h-full flex-col gap-5 bg-muted/60 p-5 transition-colors hover:bg-muted"
                      data-testid="public-league"
                    >
                      <span className="flex items-center gap-4">
                        <span className="grid size-16 shrink-0 place-items-center bg-white p-1.5">
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
                            <img src={logo} alt="" className="size-full object-contain" />
                          ) : (
                            <span className="grid size-full place-items-center bg-brand-ink font-heading text-lg font-bold text-[var(--flag-yellow)]">{l.code}</span>
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-display text-lg leading-tight font-bold uppercase">{l.name}</span>
                          {l.department && <span className="text-xs text-muted-foreground">Département : {l.department}</span>}
                        </span>
                      </span>
                      <span className="mt-auto grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                        <span className="bg-card px-2 py-2.5">
                          <strong className="block font-heading text-xl text-foreground">{l.clubs}</strong>
                          club(s) affilié(s)
                        </span>
                        <span className="bg-card px-2 py-2.5">
                          <strong className="block font-heading text-xl text-foreground">{l.ongoing}</strong>
                          compétition(s) en cours
                        </span>
                        <span className="bg-card px-2 py-2.5">
                          <strong className="block font-heading text-xl text-foreground">{l.season ? seasonLabel(l.season) : "—"}</strong>
                          saison
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
