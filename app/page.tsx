import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Carousel } from "@/components/public/carousel";
import { NewsMosaic } from "@/components/public/news-mosaic";
import { PublicShell } from "@/components/public/public-shell";
import { ArrowCircle, PillLink, SectionHead } from "@/components/public/ui";
import { formatDate } from "@/lib/format";
import { NATIONAL_TEAMS } from "@/lib/national-teams";
import { eliteClubs, homeData } from "@/lib/queries/portal";
import { competitionTables } from "@/lib/queries/competitions";
import { clubLogos } from "@/lib/club-logos";
import { ClubLogo } from "@/components/public/club-logo";
import { MatchList, MiniStandings, PreSeason } from "@/components/public/match-centre";
import { championshipLogoUrl } from "@/lib/league-logo";
import { LiveRefresh } from "@/components/live-refresh";
import { seasonLabel } from "@/lib/licenses";
import { nationalFixturesOverview } from "@/lib/queries/national";
import { NationalFixtures } from "@/components/public/national-fixtures";
import { NationalTeamCards } from "@/components/public/national-team-cards";
import { featuredPhotos, latestPhotos, photoUrl } from "@/lib/photos";
import { CountUp } from "@/components/count-up";
import { HeroSlideshow } from "@/components/public/hero-slideshow";

export const metadata: Metadata = {
  title: "FECOFOOT — Fédération Congolaise de Football",
  description: "Résultats, classements, équipes nationales, billetterie et actualités du football congolais.",
};

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Page d'accueil du portail public (EF-PUB-01). */
export default async function HomePage() {
  await connection();
  const [d, featured, gallery, nationalGames, elite] = await Promise.all([homeData(), featuredPhotos(), latestPhotos(12), nationalFixturesOverview(3), eliteClubs()]);
  const [eliteLogos, standing] = await Promise.all([
    clubLogos(elite?.teams.map((t) => t.id) ?? []),
    elite ? competitionTables(elite.competition.id) : null,
  ]);
  const slides = featured.map((p) => ({ src: photoUrl(p), caption: p.caption }));
  // Lien « toutes les photos » : la galerie de la sélection si toutes les photos en viennent, sinon les sélections.
  const galleryTeams = [...new Set(gallery.map((p) => p.teamSlug).filter(Boolean))];
  const galleryLink =
    galleryTeams.length === 1
      ? { href: `/equipes-nationales/${galleryTeams[0]}#photos`, label: `Toutes les photos des ${gallery[0].team}` }
      : { href: "/equipes-nationales", label: "Toutes les sélections" };
  const cover = slides.length > 0;
  // Championnat d'élite : sa page publique (celle du championnat national s'il y en a un) et son logo.
  const eliteHref = elite
    ? elite.competition.championship
      ? `/championnats/${elite.competition.championship.code}?saison=${elite.competition.season}`
      : `/competitions/${elite.competition.slug}`
    : "/competitions";
  const eliteLogo = elite?.competition.championship ? championshipLogoUrl(elite.competition.championship) : null;
  const table = standing?.tables[0]?.rows ?? [];
  // Aucun match de club joué ni programmé : un encart d'avant-saison remplace les listes vides.
  const quiet = d.live.length === 0 && d.results.length === 0 && d.upcoming.length === 0;
  const figures = [
    [d.clubsCount, "Clubs affiliés"],
    [d.licensesCount, "Licences validées"],
    [12, "Ligues départementales"],
    [NATIONAL_TEAMS.length, "Sélections nationales"],
  ] as const;

  // Liens rapides en colonne sur le bord gauche du bandeau (très grand écran, dans la marge).
  const quickLinks = [
    ["/competitions", "Compétitions"],
    ["/equipes-nationales", "Équipes nationales"],
    ["/billetterie", "Billetterie"],
    ["/verifier", "Vérifier une licence"],
  ] as const;

  const hero = (
    <section className="brand-band relative isolate flex min-h-[max(36rem,100svh)] flex-col overflow-hidden">
      {cover && <HeroSlideshow slides={slides} variant="background" className="-z-20" />}
      {/* Voile aux couleurs de la marque : léger en haut, dense en bas où se trouve le titre. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--brand-ink)_70%,transparent)_0%,color-mix(in_srgb,var(--brand-ink)_30%,transparent)_30%,color-mix(in_srgb,var(--brand-ink)_45%,transparent)_55%,color-mix(in_srgb,var(--flag-green)_35%,var(--brand-ink))_100%)] mix-blend-normal"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--brand-ink)_55%,transparent),transparent_55%)]" />

      {/* Écusson en filigrane, entier, sur la droite. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel décoratif */}
      <img
        src="/fecofoot-mark.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-[11%] right-[-10%] -z-10 h-[40%] w-auto opacity-20 select-none sm:right-[-6%] md:top-[12%] md:right-[4%] md:h-[62%] md:opacity-45 lg:right-[7%] lg:h-[72%] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-1000"
      />

      <nav aria-label="Accès rapide" className="absolute top-1/2 left-6 hidden -translate-y-1/2 2xl:block">
        <ul className="flex flex-col gap-4 text-[0.8rem] text-white/80">
          {quickLinks.map(([href, label], i) => (
            <li key={href} data-reveal="left" style={{ ["--rd" as string]: `${300 + i * 80}ms` }}>
              <Link href={href} className="border-l-2 border-transparent pl-2 transition-colors hover:border-[var(--flag-yellow)] hover:text-white">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Container className="mt-auto flex flex-col gap-8 pt-32 pb-8 md:flex-row md:items-end md:justify-between md:pb-10 2xl:pb-20">
        <div className="flex flex-col items-start gap-5">
          <h1 className="text-[clamp(1.6rem,8.4vw,2.6rem)] leading-[1.08] text-white sm:text-6xl lg:text-[clamp(3.5rem,8svh,5rem)]">
            {(
              [
                ["Suivre", "les compétitions"],
                ["Soutenir", "les Diables Rouges"],
                ["Vivre", "le football congolais"],
              ] as const
            ).map(([verb, rest], i) => (
              <span key={verb} data-reveal="left" style={{ ["--rd" as string]: `${150 + i * 140}ms` }} className="block whitespace-nowrap">
                <span className="font-bold text-[var(--flag-yellow)] uppercase italic">{verb}</span>{" "}
                <span className="font-normal font-sans text-[0.62em] tracking-tight normal-case">{rest}</span>
              </span>
            ))}
          </h1>
        </div>
        <div data-reveal="right" style={{ ["--rd" as string]: "600ms" }} className="self-start md:self-auto">
          {/* Transparent ; au survol, un fond blanc balaie le bouton de gauche à droite et le texte passe en vert foncé. */}
          <Link
            href="/billetterie"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-md border border-white/80 px-6 py-3 text-sm font-semibold text-white backdrop-blur-[2px] transition-[color,border-color,box-shadow,transform] duration-300 ease-out motion-safe:hover:-translate-y-0.5 hover:border-white hover:text-brand-ink hover:shadow-[0_10px_30px_rgb(255_255_255/0.25)] focus-visible:text-brand-ink focus-visible:outline-white active:translate-y-0"
          >
            <span
              aria-hidden
              className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
            />
            Découvrir la billetterie
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
          </Link>
        </div>
      </Container>
      {/* Chiffres clés : petite liste discrète. Très grand écran : dans la marge droite, en bas (pendant des liens
          rapides) ; sinon une ligne alignée à droite en bas du bandeau, sous l'écusson. */}
      <ul
        aria-label="Chiffres clés"
        className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-4 gap-y-2 px-4 pb-8 text-[0.75rem] whitespace-nowrap text-white/80 sm:px-6 sm:text-[0.8rem] md:flex md:justify-end md:gap-6 lg:px-8 2xl:absolute 2xl:right-6 2xl:bottom-[9%] 2xl:w-auto 2xl:flex-col 2xl:items-end 2xl:gap-3 2xl:p-0"
      >
        {figures.map(([n, label], i) => (
          <li key={label} data-reveal="up" style={{ ["--rd" as string]: `${750 + i * 90}ms` }} className="flex items-baseline gap-2">
            <span className="font-heading text-base font-bold text-white tabular-nums">
              <CountUp value={n} />
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <PublicShell eyebrow="Fédération Congolaise de Football" title="Suivre les compétitions, soutenir les Diables Rouges, vivre le football congolais" wide hero={hero} bare overlayHeader>
      {/* Clubs du championnat d'élite : bandeau de logos */}
      {elite && (
        <section aria-labelledby="elite-title" className="border-b bg-card/80 backdrop-blur-[2px]">
          <Container className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:gap-8">
            <div data-reveal="left" className="shrink-0">
              <h2 id="elite-title" className="font-heading text-2xl font-bold uppercase">
                <Link href={eliteHref} className="hover:text-primary">
                  {elite.competition.name}
                </Link>
              </h2>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Saison {seasonLabel(elite.competition.season)} · {elite.teams.length} clubs
              </p>
            </div>
            {/* Logos seuls (noms complets en infobulle et pour les lecteurs d'écran) : pas de noms tronqués. */}
            <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-1 lg:justify-between lg:gap-1">
              {elite.teams.map((t, i) => (
                <li key={t.id} data-reveal="zoom" style={{ ["--rd" as string]: `${i * 55}ms` }} className="shrink-0 snap-start">
                  <Link
                    href={`/clubs/${t.slug}`}
                    title={t.name}
                    aria-label={t.name}
                    className="group flex size-14 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green"
                  >
                    <ClubLogo
                      src={eliteLogos.get(t.id)}
                      name={t.name}
                      className="size-11 transition-transform duration-300 motion-safe:group-hover:scale-110"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* Résultats et calendrier */}
      <section className="py-12 sm:py-14">
        <Container className="flex flex-col gap-8">
          <SectionHead
            title="Résultats et"
            highlight="calendrier"
            aside="Les derniers scores et les prochaines affiches des championnats et coupes du Congo."
            action={
              <PillLink href="/competitions" variant="green">
                Toutes les compétitions
              </PillLink>
            }
          />
          {d.live.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border-2 border-[var(--flag-red,#dc241f)]/40 p-4">
              <MatchList title="En direct" rows={d.live} empty="" more="/matchs?vue=direct" />
              <LiveRefresh />
            </div>
          )}
          {quiet && elite ? (
            <PreSeason competition={elite.competition} teams={elite.teams.length} logo={eliteLogo} href={eliteHref} />
          ) : (
            <div className={`grid gap-8 ${table.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
              <div className="grid gap-8 lg:grid-cols-2">
                <MatchList title="Derniers résultats" rows={d.results} empty="Aucun résultat officiel pour le moment." more="/matchs?vue=resultats" />
                <MatchList title="Prochains matchs" rows={d.upcoming} empty="Aucun match programmé pour le moment." from="right" more="/matchs?vue=calendrier" />
              </div>
              {table.length > 0 && elite && <MiniStandings rows={table} logos={eliteLogos} season={elite.competition.season} href={eliteHref} />}
            </div>
          )}
        </Container>
      </section>

      {/* Actualités : mosaïque et fil d'infos */}
      <section className="pb-12 sm:pb-14">
        <Container className="flex flex-col gap-8">
          <div data-reveal="up" className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
                Toutes les <span className="text-[var(--flag-green)]">actualités</span>
              </h2>
            </div>
            <Link href="/actualites" className="group flex items-center gap-3 text-sm font-semibold hover:text-primary">
              Voir toutes les actualités
              <span aria-hidden className="text-lg text-[var(--flag-green)] transition-transform group-hover:translate-x-1">⟶</span>
            </Link>
          </div>
          {d.news.length === 0 ? <p className="text-sm text-muted-foreground">Aucune actualité.</p> : <NewsMosaic items={d.news} />}
        </Container>
      </section>

      {/* Équipes nationales */}
      <section className="py-12 sm:py-14">
        <Container className="flex flex-col gap-8">
          <SectionHead
            title="Les Diables"
            highlight="Rouges"
            aside={
              d.latestSelection
                ? `Dernière liste publiée : ${d.latestSelection.s.title} (${d.latestSelection.team.name}), le ${formatDate(d.latestSelection.s.publishedAt)}.`
                : `Les ${NATIONAL_TEAMS.length} sélections nationales : de l'équipe A aux U-15, et les Diables Rouges Dames.`
            }
            action={
              d.latestSelection ? (
                <PillLink href={`/equipes-nationales/${d.latestSelection.team.slug}`} variant="green">
                  Voir la liste
                </PillLink>
              ) : undefined
            }
          />
          <NationalFixtures {...nationalGames} />
          {gallery.length > 0 && (
            <Carousel
              label="En images"
              tone="light"
              heading={
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="font-heading text-2xl font-bold">En images</h3>
                  <Link href={galleryLink.href} className="text-sm font-semibold text-flag-green underline-offset-4 hover:underline">
                    {galleryLink.label} →
                  </Link>
                </div>
              }
            >
              {gallery.map((p, i) => (
                <li key={p.id} data-reveal="zoom" style={{ ["--rd" as string]: `${Math.min(i, 4) * 90}ms` }} className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]">
                  <Link
                    href={p.teamSlug ? `/equipes-nationales/${p.teamSlug}#photos` : "/equipes-nationales"}
                    className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-brand-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green"
                  >
                    {/* Image illustrative : la légende, juste en dessous, donne le nom du lien. Fond sombre si l'image ne charge pas. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                    <img src={photoUrl(p)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover text-transparent transition-transform duration-500 motion-safe:group-hover:scale-[1.04]" />
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(to_top,rgb(0_0_0/0.88)_0%,rgb(0_0_0/0.55)_45%,transparent_100%)]" />
                    {/* Flèche en haut : le bas des photos porte souvent le filigrane du photographe. */}
                    <ArrowCircle tone="dark" className="absolute top-3 right-3 bg-black/35 backdrop-blur-sm" />
                    <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-white">
                      {p.team && <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-flag-yellow">{p.team}</span>}
                      <span className="line-clamp-2 font-display text-lg leading-tight font-semibold uppercase">{p.caption}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </Carousel>
          )}
          <NationalTeamCards teams={NATIONAL_TEAMS} reveal />
        </Container>
      </section>
    </PublicShell>
  );
}
