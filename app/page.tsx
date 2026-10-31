import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Carousel } from "@/components/public/carousel";
import { FlipPhoto } from "@/components/public/flip-photo";
import { NewsMosaic } from "@/components/public/news-mosaic";
import { PublicShell } from "@/components/public/public-shell";
import { PillLink, SectionHead } from "@/components/public/ui";
import { ArrowIcon, CalendarIcon, TrophyIcon } from "@/components/public/icons";
import { FAMILY_ICONS } from "@/components/matches/family-icons";
import { HomeMatchCard } from "@/components/matches/home-match-card";
import { nationalTeamList } from "@/lib/queries/national";
import { eliteClubs, homeData } from "@/lib/queries/portal";
import { competitionTables } from "@/lib/queries/competitions";
import { clubLogos } from "@/lib/club-logos";
import { ClubLogo } from "@/components/public/club-logo";
import { MiniStandings, PreSeason } from "@/components/public/match-centre";
import { FollowedMarks } from "@/components/matches/favorites";
import { FeaturedMatch } from "@/components/matches/featured-match";
import type { FixtureItem } from "@/components/matches/match-card";
import { MatchTabs } from "@/components/matches/match-tabs";
import { departmentalLeagues, familyTabs, featuredFixtures, homeFixtures } from "@/lib/queries/matches";
import { championshipLogoUrl } from "@/lib/league-logo";
import { LiveRefresh } from "@/components/live-refresh";
import { seasonLabel } from "@/lib/licenses";
import { NationalTeamCards } from "@/components/public/national-team-cards";
import { SectionStack } from "@/components/section-stack";
import { featuredPhotos, latestPhotos, photoUrl, teamCovers } from "@/lib/photos";
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
  const [d, featured, gallery, elite, teams, covers] = await Promise.all([homeData(), featuredPhotos(), latestPhotos(12), eliteClubs(), nationalTeamList(), teamCovers()]);
  const [eliteLogos, standing, spotlight, tabs] = await Promise.all([
    clubLogos(elite?.teams.map((t) => t.id) ?? []),
    elite ? competitionTables(elite.competition.id) : null,
    featuredFixtures(3),
    familyTabs(),
  ]);
  // Quelques matchs par catégorie réellement configurée : l'accueil n'affiche jamais tout le calendrier.
  const [panels, departments] = await Promise.all([
    Promise.all(tabs.map((t) => (t.configured ? homeFixtures(t.family, 4) : { upcoming: [] as FixtureItem[], recent: [] as FixtureItem[] }))),
    departmentalLeagues(),
  ]);
  const slides = featured.map((p) => ({ src: photoUrl(p), caption: p.caption }));
  const cover = slides.length > 0;
  // Championnat d'élite : sa page publique (celle du championnat national s'il y en a un) et son logo.
  const eliteHref = elite
    ? elite.competition.championship
      ? `/championnats/${elite.competition.championship.code}?saison=${elite.competition.season}`
      : `/competitions/${elite.competition.slug}`
    : "/competitions";
  const eliteLogo = elite?.competition.championship ? championshipLogoUrl(elite.competition.championship) : null;
  const table = standing?.tables[0]?.rows ?? [];
  const started = table.some((r) => r.played > 0);
  const hasLive = (items: FixtureItem[]) => items.some((i) => i.status === "LIVE");
  // Onglet ouvert : celui d'un match en direct, sinon du prochain match, sinon du dernier résultat.
  const soonest = tabs
    .map((t, i) => ({ t, next: panels[i].upcoming[0]?.kickoffAt?.getTime() }))
    .filter((x) => x.next !== undefined)
    .sort((a, b) => a.next! - b.next!)[0];
  const initialTab =
    tabs.find((_, i) => hasLive(panels[i].upcoming))?.family ?? soonest?.t.family ?? tabs.find((_, i) => panels[i].recent.length > 0)?.family ?? tabs[0]?.family ?? "";
  // Chiffres clés : seulement ceux qui ont une valeur (un « 0 » ne dit rien d'utile au visiteur).
  const figures = ([
    [d.clubsCount, "Clubs affiliés"],
    [d.licensesCount, "Licences validées"],
    [d.leaguesCount, "Ligues départementales"],
    [teams.length, "Sélections nationales"],
  ] as const).filter(([n]) => n > 0);

  // Liens rapides en colonne sur le bord gauche du bandeau (très grand écran, dans la marge).
  const quickLinks = [
    ["/competitions", "Compétitions"],
    ["/equipes-nationales", "Équipes nationales"],
    ["/billetterie", "Billetterie"],
    ["/verifier", "Vérifier une licence"],
  ] as const;

  const hero = (
    <section data-stack className="brand-band relative isolate flex min-h-[max(36rem,100svh)] flex-col overflow-hidden">
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
        className="pointer-events-none absolute top-[11%] right-[-10%] -z-10 h-[40%] w-auto opacity-10 select-none sm:right-[-6%] md:top-[12%] md:right-[4%] md:h-[62%] md:opacity-25 lg:opacity-35 lg:right-[7%] lg:h-[72%] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-1000"
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
      <SectionStack />
      {/* Clubs du championnat d'élite : bandeau de logos */}
      {elite && (
        <section aria-labelledby="elite-title" className="relative z-[1] border-b bg-card">
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
                <li key={t.id} data-reveal="left" style={{ ["--rd" as string]: `${i * 60}ms` }} className="shrink-0 snap-start">
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

      {/* Matchs et résultats : à la une, puis une sélection courte par catégorie */}
      <section data-stack aria-labelledby="matchs-title" className="relative bg-background py-12 sm:py-14">
        <Container className="flex flex-col gap-8">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div data-reveal="left" className="flex flex-col gap-3">
              <h2 id="matchs-title" className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
                Matchs &amp; <span className="text-[var(--flag-green)]">résultats</span>
              </h2>
              <p className="max-w-2xl text-muted-foreground">
                Sélections, divisions nationales, ligues, coupes, jeunes et football féminin : les rencontres officielles, scores validés par les organisateurs.
              </p>
            </div>
            <div data-reveal="right">
              <PillLink href="/matchs" variant="green">
                Voir tous les matchs
              </PillLink>
            </div>
          </div>
          {(hasLive(spotlight) || panels.some((p) => hasLive(p.upcoming))) && <LiveRefresh seconds={20} />}
          <FollowedMarks />

          {spotlight.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="flex items-center gap-2 font-heading text-xl font-bold uppercase">
                <span aria-hidden className="text-[var(--flag-yellow)]">★</span> À la une
              </h3>
              <ul className={`grid gap-4 md:grid-cols-2 ${spotlight.length >= 3 ? "xl:grid-cols-3" : ""}`}>
                {spotlight.map((item, i) => (
                  <FeaturedMatch key={item.key} item={item} index={i} />
                ))}
              </ul>
            </div>
          )}

          {tabs.length > 0 ? (
            <MatchTabs
              reveal
              initial={initialTab}
              tabs={tabs.map((t, i) => {
                const p = panels[i];
                const elitePanel = t.family === "ligue-1" && elite;
                const all = `/matchs?categorie=${t.family}`;
                const column = (kind: "upcoming" | "recent", items: FixtureItem[]) => {
                  const upcoming = kind === "upcoming";
                  return (
                    <div data-reveal="left" style={{ ["--rd" as string]: upcoming ? "0ms" : "160ms" }} className="flex min-w-0 flex-col gap-4 bg-muted/60 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="flex flex-col gap-2">
                          <span className="flex items-center gap-2.5 font-heading text-xl font-bold uppercase">
                            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]">
                              {upcoming ? <CalendarIcon className="size-[1.1rem]" /> : <TrophyIcon className="size-[1.1rem]" />}
                            </span>
                            {upcoming ? "Prochains matchs" : "Derniers résultats"}
                          </span>
                          <span aria-hidden className="h-0.5 w-10 bg-[var(--flag-green)]" />
                        </h3>
                        {upcoming ? (
                          <Link href={all} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                            Voir tous les matchs
                            <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        ) : (
                          <Link href={all} className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/20 px-4 text-sm font-semibold transition-colors hover:border-[var(--flag-green)] hover:text-[var(--flag-green)]">
                            <CalendarIcon className="size-4" />
                            Calendrier complet
                          </Link>
                        )}
                      </div>
                      {items.length === 0 ? (
                        <p className="bg-card px-4 py-6 text-center text-sm text-muted-foreground">{upcoming ? "Aucun match programmé pour le moment." : "Aucun résultat publié pour le moment."}</p>
                      ) : (
                        <ul className="flex flex-col gap-3">
                          {items.map((item, i) => (
                            <HomeMatchCard key={item.key} item={item} index={i} />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                };
                let panel: ReactNode;
                if (p.upcoming.length === 0 && p.recent.length === 0) {
                  panel = elitePanel ? (
                    <PreSeason competition={elite.competition} clubs={elite.teams} logos={eliteLogos} logo={eliteLogo} href={eliteHref} />
                  ) : (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
                      <p className="font-semibold">
                        {t.configured ? `Aucun match publié pour « ${t.label} » pour le moment.` : `Aucune compétition « ${t.label} » n'est encore publiée.`}
                      </p>
                      <p className="max-w-lg text-sm text-muted-foreground">Les rencontres apparaîtront ici dès la publication du calendrier par l&apos;organisateur.</p>
                      {/* Accès utiles en attendant : pages existantes de la catégorie. */}
                      {t.family === "departementales" && departments.length > 0 && (
                        <ul className="grid w-full max-w-3xl grid-cols-2 gap-2 text-left text-sm sm:grid-cols-3 lg:grid-cols-4">
                          {departments.map((l) => (
                            <li key={l.code}>
                              <Link href={`/ligues/${l.code.toLowerCase()}`} className="flex h-full items-center gap-2 rounded-lg border bg-card px-3 py-2 font-medium hover:bg-muted">
                                <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
                                {l.department ?? l.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(t.family === "feminin" || t.family === "jeunes") && (
                        <div className="flex flex-wrap justify-center gap-2">
                          {teams.filter((n) => (t.family === "feminin" ? n.code === "WOMEN" : ["U23", "U20", "U17", "U15"].includes(n.code))).map((n) => (
                            <Link key={n.slug} href={`/equipes-nationales/${n.slug}`} className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
                              {n.name}
                            </Link>
                          ))}
                        </div>
                      )}
                      <Link href={t.family === "departementales" ? "/ligues" : "/matchs"} className="text-sm font-semibold text-flag-green underline-offset-4 hover:underline">
                        {t.family === "departementales" ? "Toutes les ligues départementales →" : "Voir le calendrier complet →"}
                      </Link>
                    </div>
                  );
                } else {
                  panel = (
                    <div className={`grid gap-6 ${elitePanel && started ? "lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]" : "lg:grid-cols-2"}`}>
                      {column("upcoming", p.upcoming)}
                      {column("recent", p.recent)}
                      {elitePanel && started && <MiniStandings rows={table} logos={eliteLogos} season={elite.competition.season} href={eliteHref} />}
                    </div>
                  );
                }
                return { id: t.family, label: t.label, icon: FAMILY_ICONS[t.family], live: hasLive(p.upcoming), panel };
              })}
            />
          ) : (
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Aucune compétition publiée pour le moment.</p>
          )}
        </Container>
      </section>

      {/* Actualités : mosaïque et fil d'infos */}
      <section data-stack className="relative bg-background pt-12 pb-6 sm:pt-14 sm:pb-8">
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
      <section data-stack className="relative bg-background pt-10 pb-12 sm:pt-12 sm:pb-14">
        <Container className="flex flex-col gap-8">
          <SectionHead
            title="Les Diables"
            highlight="Rouges"
          />
          {gallery.length > 0 && (
            // Portraits de même format, sans texte sur l'image ; légende au survol.
            <div>
              <Carousel
                label="En images"
                autoplay={4000}
              >
                {gallery.map((p, i) => (
                  <li key={p.id} data-reveal="left" style={{ ["--rd" as string]: `${Math.min(i, 4) * 120}ms` }} className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]">
                    {/* Touchée, la photo se retourne et affiche sa légende. */}
                    <FlipPhoto src={photoUrl(p)} caption={p.caption} team={p.team} credit={p.credit} href={p.teamSlug ? `/equipes-nationales/${p.teamSlug}#photos` : "/equipes-nationales"} />
                  </li>
                ))}
              </Carousel>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-6 sm:mt-10">
            <h3 data-reveal="left" className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
              Nos sélections <span className="text-[var(--flag-green)]">nationales</span>
            </h3>
            <NationalTeamCards teams={teams} covers={covers} reveal />
          </div>
        </Container>
      </section>
    </PublicShell>
  );
}
