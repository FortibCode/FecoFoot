import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { PaginatedStandings } from "@/components/competitions/paginated-standings";
import { Carousel } from "@/components/public/carousel";
import { NewsMosaic } from "@/components/public/news-mosaic";
import { PublicShell } from "@/components/public/public-shell";
import { ArrowCircle, PillLink, SectionHead } from "@/components/public/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { NATIONAL_TEAMS } from "@/lib/national-teams";
import type { MatchRow } from "@/lib/queries/competitions";
import { eliteClubs, homeData } from "@/lib/queries/portal";
import { competitionTables } from "@/lib/queries/competitions";
import { clubLogos } from "@/lib/club-logos";
import { ClubLogo } from "@/components/public/club-logo";
import { LiveRefresh } from "@/components/live-refresh";
import { isLive, MATCH_STATUS_LABELS } from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import { nationalFixturesOverview } from "@/lib/queries/national";
import { NationalFixtures } from "@/components/public/national-fixtures";
import { featuredPhotos, latestPhotos, photoUrl } from "@/lib/photos";
import { CountUp } from "@/components/count-up";
import { HeroSlideshow } from "@/components/public/hero-slideshow";

export const metadata: Metadata = {
  title: "FECOFOOT — Fédération Congolaise de Football",
  description: "Résultats, classements, équipes nationales, billetterie et actualités du football congolais.",
};

const teamName = (c: MatchRow["home"]) => c?.shortName ?? c?.name ?? "À déterminer";

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Ligne de la liste des matchs : rencontre, compétition, date, flèche. */
function MatchListRow({ row }: { row: MatchRow }) {
  const m = row.match;
  const live = isLive(m.status);
  const played = m.status === "FINISHED" || live;
  return (
    <li>
      <Link
        href={`/matchs/${m.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b py-4 transition-colors hover:bg-accent/60 sm:px-2"
      >
        <span className="flex min-w-0 items-center gap-3 font-heading text-lg font-semibold uppercase sm:text-xl">
          {row.home && <ClubLogo src={row.home.logo} name={row.home.name} className="size-8 text-xs" />}
          <span className="truncate">{teamName(row.home)}</span>
          {played ? (
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-base text-white tabular-nums ${live ? "bg-[var(--flag-red,#dc241f)]" : "bg-brand-ink"}`}>
              {m.homeScore ?? 0} – {m.awayScore ?? 0}
            </span>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">vs</span>
          )}
          <span className="truncate">{teamName(row.away)}</span>
          {row.away && <ClubLogo src={row.away.logo} name={row.away.name} className="size-8 text-xs" />}
        </span>
        <ArrowCircle className="row-span-2" />
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--flag-green)]">{row.competition.name}</span>
          {live ? (
            <span className="text-xs font-bold text-[var(--flag-red,#dc241f)] uppercase">● {MATCH_STATUS_LABELS[m.status]}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{m.kickoffAt ? formatDateTime(m.kickoffAt) : "Date à fixer"}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function MatchList({ title, rows, empty, from = "left" }: { title: string; rows: MatchRow[]; empty: string; from?: "left" | "right" }) {
  return (
    <div data-reveal={from} className="flex min-w-0 flex-col">
      <h3 className="border-b-2 border-foreground pb-2 font-heading text-xl font-bold uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="border-b py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <MatchListRow key={r.match.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
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
  const cover = slides.length > 0;
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
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-md border border-white/80 px-6 py-3 text-sm font-semibold text-white backdrop-blur-[2px] transition-[color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-white hover:text-brand-ink hover:shadow-[0_10px_30px_rgb(255_255_255/0.25)] focus-visible:text-brand-ink focus-visible:outline-white active:translate-y-0"
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
                {elite.competition.name}
              </h2>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Saison {seasonLabel(elite.competition.season)} · {elite.teams.length} clubs
              </p>
            </div>
            <ul className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-1 lg:justify-between">
              {elite.teams.map((t, i) => (
                <li key={t.id} data-reveal="zoom" style={{ ["--rd" as string]: `${i * 55}ms` }} className="shrink-0 snap-start">
                  <Link
                    href={`/clubs/${t.slug}`}
                    title={t.name}
                    className="group flex w-16 flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors hover:bg-muted sm:w-[4.5rem]"
                  >
                    <ClubLogo
                      src={eliteLogos.get(t.id)}
                      name={t.name}
                      className="size-11 grayscale-[15%] transition-transform duration-300 group-hover:scale-110 group-hover:grayscale-0 sm:size-12"
                    />
                    <span className="w-full truncate text-center text-[0.65rem] font-semibold">{t.shortName ?? t.name}</span>
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
              <MatchList title="En direct" rows={d.live} empty="" />
              <LiveRefresh />
            </div>
          )}
          <div className="grid gap-8 lg:grid-cols-2">
            <MatchList title="Derniers résultats" rows={d.results} empty="Aucun résultat." />
            <MatchList title="Prochains matchs" rows={d.upcoming} empty="Aucun match programmé." from="right" />
          </div>
        </Container>
      </section>

      {/* Classement du championnat d'élite */}
      {standing && standing.tables[0] && (
        <section aria-labelledby="classement-title" className="pb-12 sm:pb-14">
          <Container className="flex flex-col gap-6">
            <div data-reveal="up" className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 id="classement-title" className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
                  Classement <span className="text-[var(--flag-green)]">{standing.competition.name}</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Saison {seasonLabel(standing.competition.season)}
                  {standing.competition.status === "DRAFT" && " · le championnat n'a pas encore commencé : classement à zéro, par ordre alphabétique"}
                </p>
              </div>
              {standing.competition.status !== "DRAFT" && (
                <PillLink href={`/competitions/${standing.competition.slug}`} variant="green">
                  Calendrier et statistiques
                </PillLink>
              )}
            </div>
            {standing.tables.map((t) => (
              <PaginatedStandings key={t.pool} rows={t.rows} title={t.pool ? `Poule ${t.pool}` : undefined} logos={Object.fromEntries(eliteLogos)} />
            ))}
          </Container>
        </section>
      )}

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
                : "Les six sélections nationales, des U-17 à l'équipe A, et les Diables Rouges Dames."
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
            <Carousel label="En images" tone="light">
              {gallery.map((p, i) => (
                <li key={p.id} data-reveal="up" style={{ ["--rd" as string]: `${Math.min(i, 4) * 90}ms` }} className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]">
                  <Link href={p.teamSlug ? `/equipes-nationales/${p.teamSlug}#photos` : "/equipes-nationales"} className="group relative block overflow-hidden rounded-2xl shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                    <img src={photoUrl(p)} alt={p.caption} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-[linear-gradient(0deg,rgb(0_0_0/0.75),transparent)] p-4 pt-12 text-white">
                      <span className="flex flex-col gap-1">
                        {p.team && <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--flag-yellow)]">{p.team}</span>}
                        <span className="font-heading text-lg leading-tight font-semibold uppercase">{p.caption}</span>
                      </span>
                      <ArrowCircle tone="dark" />
                    </span>
                  </Link>
                </li>
              ))}
            </Carousel>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NATIONAL_TEAMS.map((t, i) => (
              <li key={t.slug} data-reveal="up" style={{ ["--rd" as string]: `${i * 70}ms` }}>
                <Link
                  href={`/equipes-nationales/${t.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="flex items-center gap-4">
                    <span aria-hidden className="h-10 w-1.5 rounded-full bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
                    <span className="font-heading text-xl font-bold uppercase">{t.name}</span>
                  </span>
                  <ArrowCircle />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </PublicShell>
  );
}
