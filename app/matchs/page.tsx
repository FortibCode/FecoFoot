import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { FavoritesScope } from "@/components/matches/favorites";
import { FAMILY_ICONS } from "@/components/matches/family-icons";
import { FixtureRow, NextFixture } from "@/components/matches/fixture-row";
import { SideScorers, SideStandings } from "@/components/public/match-centre";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  FilterIcon,
  PauseIcon,
  ResetIcon,
  SearchIcon,
  SwapIcon,
  TrophyIcon,
} from "@/components/public/icons";
import { clubLogos } from "@/lib/club-logos";
import { competitionTables } from "@/lib/queries/competitions";
import type { FixtureItem } from "@/components/matches/match-card";
import { PublicShell } from "@/components/public/public-shell";
import {
  MATCH_FAMILIES,
  PUBLIC_MATCH_STATUS_LABELS,
  PUBLIC_MATCH_STATUSES,
  type MatchFamily,
  type PublicMatchStatus,
} from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import {
  addDays,
  championshipView,
  familyTabs,
  fixturesByCompetition,
  fixtureCounts,
  fixtureFilterOptions,
  fixturesByDay,
  publicFixtures,
  withFamily,
  type MatchFilters,
} from "@/lib/queries/matches";

export const metadata: Metadata = {
  title: "Matchs et résultats — FECOFOOT",
  description:
    "Matchs en direct, calendrier et résultats officiels des compétitions de la Fédération Congolaise de Football et des Diables Rouges.",
};

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Statut dans l'adresse (en français) ; les anciennes vues « résultats / calendrier / direct » restent valables. */
const STATUS_SLUGS: Record<PublicMatchStatus, string> = {
  LIVE: "direct",
  UPCOMING: "a-venir",
  FINISHED: "termines",
  POSTPONED: "reportes",
  SUSPENDED: "suspendus",
  CANCELLED: "annules",
};
const LEGACY_VIEWS: Record<string, PublicMatchStatus> = {
  resultats: "FINISHED",
  calendrier: "UPCOMING",
  direct: "LIVE",
};
const TAB_LABELS: Record<PublicMatchStatus, string> = {
  ...PUBLIC_MATCH_STATUS_LABELS,
  FINISHED: "Résultats",
  POSTPONED: "Reportés",
  SUSPENDED: "Suspendus",
  CANCELLED: "Annulés",
};
/** Pictogramme de chaque statut (le libellé reste écrit à côté). */
const STATUS_ICONS: Record<PublicMatchStatus, ReactNode> = {
  LIVE: null,
  UPCOMING: <ClockIcon />,
  FINISHED: <CheckCircleIcon />,
  POSTPONED: <SwapIcon />,
  SUSPENDED: <PauseIcon />,
  CANCELLED: <CloseIcon />,
};
/** Divisions nationales : vue championnat (classement et prochains rendez-vous à côté des matchs). */
const CHAMPIONSHIPS: MatchFamily[] = ["ligue-1", "ligue-2"];
const PAGE = 40;

const today = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const weekday = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "short",
});
const dayNum = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const longDay = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Brazzaville",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
const dayKey = (d: Date | null) =>
  d ? new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10) : "";

type SearchParams = Awaited<PageProps<"/matchs">["searchParams"]>;

export default function PublicMatchesPage({
  searchParams,
}: PageProps<"/matchs">) {
  return (
    <PublicShell
      eyebrow="Compétitions"
      title="Matchs et résultats"
      subtitle="En direct, calendrier et résultats officiels du football congolais, clubs et sélections nationales"
      wide
    >
      <Suspense fallback={<Skeleton />}>
        <Matches searchParams={searchParams} />
      </Suspense>
    </PublicShell>
  );
}

/** Chargement : la forme de la page (catégories, statuts, dates, filtres) et des cartes de match. */
function Skeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement des matchs"
      className="flex flex-col gap-5 motion-safe:animate-pulse"
    >
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-36 shrink-0 rounded-full bg-muted" />
        ))}
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-28 shrink-0 rounded-full bg-muted/70" />
        ))}
      </div>
      <div className="h-20 bg-muted/60" />
      <div className="h-24 bg-muted/60" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4 bg-muted/60 p-5">
          <div className="h-5 w-40 rounded-full bg-muted" />
          <div className="grid grid-cols-[1fr_6rem_1fr] items-center gap-4">
            <div className="flex items-center justify-end gap-3">
              <div className="h-4 w-24 bg-muted" />
              <div className="size-11 rounded-full bg-muted" />
            </div>
            <div className="mx-auto h-8 w-16 bg-muted" />
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-muted" />
              <div className="h-4 w-24 bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Titre de liste de la page (sections « En direct et à venir », « Derniers matchs », jours). */
function ListHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase first-letter:uppercase"
    >
      {children}
    </h3>
  );
}

async function Matches({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Liste vivante : calculée à chaque visite.
  await connection();
  const sp = await searchParams;
  const rawComp = one(sp.competition);
  const status =
    (Object.keys(STATUS_SLUGS) as PublicMatchStatus[]).find(
      (s) => STATUS_SLUGS[s] === one(sp.statut),
    ) ?? LEGACY_VIEWS[one(sp.vue) ?? ""];
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date) ?? "") &&
    !Number.isNaN(asDate(one(sp.date)!).getTime())
      ? one(sp.date)
      : undefined;
  const family = MATCH_FAMILIES.find((f) => f === one(sp.categorie)) as
    MatchFamily | undefined;
  const search = one(sp.q)?.slice(0, 60);
  const round = Number(one(sp.journee)) || undefined;
  const selectionSlug = one(sp.selection);

  const [options, families] = await Promise.all([
    fixtureFilterOptions(),
    familyTabs(),
  ]);
  const selection = options.teams.find((t) => t.slug === selectionSlug);
  const base: MatchFilters = await withFamily({
    family,
    competition:
      rawComp === "selections" ? "selections" : Number(rawComp) || undefined,
    season: Number(one(sp.saison)) || undefined,
    club: Number(one(sp.equipe)) || undefined,
    status,
    date,
    search,
    selection: selection?.id,
  });
  // Ligue 1, Ligue 2 : la compétition de la saison choisie (la plus récente par défaut).
  const champ =
    family && CHAMPIONSHIPS.includes(family) && !rawComp
      ? await championshipView(base.competitionIds ?? [], base.season)
      : null;
  const filters: MatchFilters = champ
    ? { ...base, competition: champ.competition.id, season: undefined, round }
    : base;
  const limit = Math.min(400, Math.max(PAGE, Number(one(sp.nombre)) || PAGE));
  const weekStart = addDays(date ?? today(), -3);

  const [
    { sections },
    { counts, stale },
    days,
    byComp,
    standing,
    next,
  ] = await Promise.all([
    publicFixtures(filters, limit),
    fixtureCounts(filters),
    fixturesByDay(filters, weekStart),
    fixturesByCompetition(filters),
    champ ? competitionTables(champ.competition.id) : null,
    champ
      ? publicFixtures(
          { competition: champ.competition.id, status: "UPCOMING" },
          2,
        )
      : null,
  ]);
  const table = standing?.tables[0]?.rows ?? [];
  const scorers = standing?.scorers ?? [];
  const logos = await clubLogos(table.map((r) => r.clubId));
  const upcomingNext = next?.sections[0].items ?? [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0) + stale;
  const live = sections.some((s) => s.items.some((i) => i.status === "LIVE"));
  const more = sections.some((s) => s.more);
  // Critères choisis par le visiteur (la catégorie seule n'en est pas un : elle a son propre état vide).
  const narrowed = Boolean(
    rawComp ||
      base.season ||
      filters.club ||
      status ||
      date ||
      round ||
      search ||
      selection,
  );
  const filtered = Boolean(family) || narrowed;

  // Adresse de la page avec les critères courants, modifiés par `extra`.
  const current = {
    categorie: family,
    competition:
      rawComp &&
      filters.competition &&
      !(family === "selections" && rawComp !== "selections")
        ? String(rawComp)
        : undefined,
    saison: base.season ? String(base.season) : undefined,
    equipe: filters.club ? String(filters.club) : undefined,
    selection: selection?.slug,
    journee: champ && round ? String(round) : undefined,
    q: search,
    statut: status ? STATUS_SLUGS[status] : undefined,
    date,
  };
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...extra }))
      if (v) q.set(k, v);
    const s = q.toString();
    return `/matchs${s ? `?${s}` : ""}`;
  };
  // Champs cachés d'un formulaire : les critères courants qu'il ne modifie pas.
  const keep = (...edited: (keyof typeof current)[]) =>
    Object.entries(current)
      .filter(([k, v]) => v && !edited.includes(k as keyof typeof current))
      .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:border-[var(--flag-green)] hover:text-[var(--flag-green)]"}`;
  const field =
    "flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const select =
    "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm font-normal normal-case tracking-normal text-foreground";
  const side = (active: boolean) =>
    `flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${active ? "bg-brand-ink font-semibold text-white" : "hover:bg-muted"}`;
  const selectedComp =
    rawComp === "selections" ? "selections" : filters.competition;
  const scroller =
    "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0";

  // 2. Catégories : Sélections, Ligue 1, Ligue 2, départementales, coupes, féminin, jeunes.
  const categories = (
    <nav aria-label="Catégories de matchs" className={scroller}>
      <ul className="flex gap-1.5 [&_a]:gap-1.5 [&_a]:px-3">
        <li>
          <Link
            href="/matchs"
            aria-current={!family ? "page" : undefined}
            className={chip(!family)}
          >
            Toutes
          </Link>
        </li>
        {families.map((f) => (
          <li key={f.family}>
            <Link
              href={`/matchs?categorie=${f.family}`}
              aria-current={family === f.family ? "page" : undefined}
              className={chip(family === f.family)}
            >
              {FAMILY_ICONS[f.family]}
              {f.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  // 3. Statuts, avec le nombre réel de rencontres de chacun.
  const statusNav = (
    <nav aria-label="Statut des matchs" className={scroller}>
      <ul className="flex gap-2 xl:flex-wrap">
        {[undefined, ...PUBLIC_MATCH_STATUSES].map((s) => (
          <li key={s ?? "all"}>
            <Link
              href={href({ statut: s ? STATUS_SLUGS[s] : undefined })}
              className={`${chip(status === s)} h-9 text-[0.8rem]`}
              aria-current={status === s ? "page" : undefined}
            >
              {s === "LIVE" ? (
                <span
                  aria-hidden
                  className={`size-2 rounded-full bg-[var(--flag-red)] ${counts.LIVE > 0 ? "motion-safe:animate-pulse" : ""}`}
                />
              ) : (
                s && STATUS_ICONS[s]
              )}
              {s ? TAB_LABELS[s] : "Tous"}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${status === s ? "bg-white/20" : "bg-muted"}`}
              >
                {s ? counts[s] : total}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  // 4. Dates : une semaine (flèches), une date précise (sélecteur) et retour au jour même.
  const arrow =
    "grid size-10 shrink-0 place-items-center rounded-full bg-card transition-colors hover:bg-[var(--flag-green)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green";
  const dateNav = (
    <div className="flex flex-col gap-3 bg-muted/60 p-2 sm:p-3">
      <nav aria-label="Navigation par date" className="flex items-center gap-2 sm:gap-3">
        <Link
          href={href({ date: addDays(weekStart, -4) })}
          aria-label="Semaine précédente"
          className={arrow}
        >
          <ChevronIcon dir="left" />
        </Link>
        <ul className="grid min-w-0 flex-1 grid-cols-7 gap-1 sm:gap-2">
          {days.map(({ day, count }) => {
            const active = day === date;
            const isToday = day === today();
            return (
              <li key={day}>
                <Link
                  href={href({ date: active ? undefined : day })}
                  aria-current={active ? "date" : undefined}
                  aria-label={`${longDay.format(asDate(day))} : ${count} match${count > 1 ? "s" : ""}`}
                  className={`flex flex-col items-center px-0.5 py-2 text-center transition-colors ${active ? "bg-brand-ink text-white" : count > 0 ? "bg-card hover:bg-muted" : "bg-card/60 text-muted-foreground hover:bg-card"} ${isToday && !active ? "ring-1 ring-[var(--flag-green)] ring-inset" : ""}`}
                >
                  <span className="text-[0.65rem] font-semibold uppercase">
                    {isToday
                      ? "Auj."
                      : weekday.format(asDate(day)).replace(".", "")}
                  </span>
                  <span className="font-heading text-sm font-bold whitespace-nowrap sm:text-base">
                    <span className="sm:hidden">{asDate(day).getUTCDate()}</span>
                    <span className="hidden sm:inline">
                      {dayNum.format(asDate(day)).replace(".", "")}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`mt-1 size-1.5 rounded-full ${count > 0 ? (active ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-green)]") : "bg-transparent"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href={href({ date: addDays(weekStart, 10) })}
          aria-label="Semaine suivante"
          className={arrow}
        >
          <ChevronIcon />
        </Link>
      </nav>
      <form
        action="/matchs"
        aria-label="Aller à une date"
        className="flex flex-wrap items-center justify-end gap-2 text-sm"
      >
        {keep("date")}
        <label className="flex items-center gap-2 font-semibold">
          <CalendarIcon className="size-4 text-[var(--flag-green)]" />
          <span>Aller au</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={date ?? today()}
            className="h-9 rounded-md border bg-card px-2 font-normal"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-brand-ink px-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green"
        >
          Afficher
        </button>
        {date !== today() && (
          <Link
            href={href({ date: today() })}
            className="inline-flex h-9 items-center bg-card px-3 font-semibold hover:text-[var(--flag-green)]"
          >
            Aujourd&apos;hui
          </Link>
        )}
      </form>
    </div>
  );

  // 5. Filtres avancés : ils s'ajoutent à la catégorie, au statut et à la date choisis.
  const resetHref = family ? `/matchs?categorie=${family}` : "/matchs";
  const searchField = (
    <label className={field}>
      Recherche
      <span className="relative flex items-center">
        <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={
            champ ? "Rechercher un club…" : "Club, sélection, compétition…"
          }
          className={`${select} pl-9`}
        />
      </span>
    </label>
  );
  const buttons = (
    <div className="col-span-2 flex gap-2 lg:col-span-1">
      <button
        type="submit"
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green lg:flex-none"
      >
        <FilterIcon />
        Filtrer
      </button>
      {narrowed && (
        <Link
          href={resetHref}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-semibold hover:bg-muted lg:flex-none"
        >
          <ResetIcon />
          Réinitialiser
        </Link>
      )}
    </div>
  );
  const familyComps = base.competitionIds
    ? options.comps.filter((c) => base.competitionIds!.includes(c.id))
    : options.comps;
  const champClubs = [...table].sort((a, b) => a.name.localeCompare(b.name));
  const form = (
    <form
      action="/matchs"
      aria-label="Filtrer les matchs"
      className={`grid grid-cols-2 gap-3 bg-muted/60 p-4 lg:items-end ${champ ? "lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)_auto]" : "lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"}`}
    >
      {keep("categorie", "competition", "saison", "equipe", "selection", "journee", "q")}
      {champ ? (
        <>
          <input type="hidden" name="categorie" value={family} />
          <label className={field}>
            Saison
            <select
              name="saison"
              defaultValue={champ.competition.season}
              className={select}
            >
              {champ.seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Journée
            <select name="journee" defaultValue={round ?? ""} className={select}>
              <option value="">Toutes les journées</option>
              {champ.rounds.map((r) => (
                <option key={r} value={r}>
                  Journée {r}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Équipe
            <select
              name="equipe"
              defaultValue={filters.club ?? ""}
              className={select}
            >
              <option value="">Toutes les équipes</option>
              {champClubs.map((c) => (
                <option key={c.clubId} value={c.clubId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className={field}>
            Catégorie
            <select
              name="categorie"
              defaultValue={family ?? ""}
              className={select}
            >
              <option value="">Toutes</option>
              {families.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {family === "selections" ? (
            <label className={field}>
              Sélection
              <select
                name="selection"
                defaultValue={selection?.slug ?? ""}
                className={select}
              >
                <option value="">Toutes les sélections</option>
                {options.teams.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className={field}>
              Compétition
              <select
                name="competition"
                defaultValue={rawComp ?? ""}
                className={select}
              >
                <option value="">Toutes</option>
                {!family && (
                  <option value="selections">
                    Équipes nationales (Diables Rouges)
                  </option>
                )}
                {familyComps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({seasonLabel(c.season)})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={field}>
            Saison
            <select
              name="saison"
              defaultValue={base.season ?? ""}
              className={select}
            >
              <option value="">Toutes</option>
              {options.seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s)}
                </option>
              ))}
            </select>
          </label>
          {family !== "selections" && (
            <label className={field}>
              Équipe
              <select
                name="equipe"
                defaultValue={filters.club ?? ""}
                className={select}
              >
                <option value="">Toutes</option>
                {options.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <div
        className={`col-span-2 ${champ || family === "selections" ? "lg:col-span-1" : "lg:col-span-4"}`}
      >
        {searchField}
      </div>
      {buttons}
    </form>
  );

  const dateNote = date && (
    <p className="flex flex-wrap items-center gap-3 text-sm">
      <span>
        Matchs du <strong>{longDay.format(asDate(date))}</strong>
      </span>
      <Link
        href={href({ date: undefined })}
        className="font-semibold text-flag-green underline-offset-4 hover:underline"
      >
        Toutes les dates
      </Link>
    </p>
  );

  // États vides : jour sans match, critères sans résultat, calendrier pas encore publié.
  const category = families.find((f) => f.family === family);
  const noneAtAll = total === 0 && !narrowed;
  const empty = sections.every((s) => s.items.length === 0) && (
    <div className="flex flex-col items-center gap-3 bg-muted/60 p-10 text-center">
      <CalendarIcon className="size-8 text-[var(--flag-green)]" />
      <p className="font-semibold">
        {noneAtAll
          ? category && !category.configured
            ? `Aucune compétition « ${category.label} » n'est encore publiée.`
            : champ
              ? `Le calendrier de la saison ${seasonLabel(champ.competition.season)} n'est pas encore publié.`
              : "Aucun match publié pour le moment."
          : date && !narrowedExceptDate()
            ? "Aucun match programmé pour cette date."
            : status === "LIVE" && !date
              ? "Aucun match en cours."
              : "Aucun match ne correspond à vos critères."}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {noneAtAll || (date && !narrowedExceptDate())
          ? "Les rencontres apparaîtront ici dès la publication des calendriers officiels par les organisateurs."
          : "Modifiez les filtres (statut, date, saison, équipe ou recherche) pour élargir la liste."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {narrowed && (
          <Link
            href={resetHref}
            className="inline-flex items-center gap-2 bg-card px-4 py-2 text-sm font-semibold hover:text-[var(--flag-green)]"
          >
            <ResetIcon />
            Modifier les filtres
          </Link>
        )}
        {filtered && (
          <Link
            href="/matchs"
            className="bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Voir tous les matchs
          </Link>
        )}
      </div>
    </div>
  );
  function narrowedExceptDate() {
    return Boolean(
      rawComp || base.season || filters.club || status || round || search || selection,
    );
  }

  const moreLink = more && (
    <div className="flex justify-center">
      <Link
        href={href({ nombre: String(limit + PAGE) })}
        scroll={false}
        className="bg-muted/60 px-5 py-2.5 text-sm font-semibold hover:bg-muted"
      >
        Voir plus de matchs
      </Link>
    </div>
  );

  // 6. Les rencontres : par section (à venir / derniers matchs) puis par jour.
  const list = (
    <FavoritesScope>
      {empty || (
        <div className="flex flex-col gap-10">
          {sections
            .filter((s) => s.items.length > 0)
            .map((s) => {
              const byDay = new Map<string, FixtureItem[]>();
              for (const i of s.items)
                byDay.set(dayKey(i.kickoffAt), [
                  ...(byDay.get(dayKey(i.kickoffAt)) ?? []),
                  i,
                ]);
              return (
                <section
                  key={s.key}
                  data-section
                  aria-labelledby={s.title ? `section-${s.key}` : undefined}
                  className="flex flex-col gap-5"
                >
                  {s.title && (
                    <h2
                      id={`section-${s.key}`}
                      className="flex items-center gap-2.5 font-heading text-xl font-bold uppercase"
                    >
                      {s.key === "past" ? (
                        <CheckCircleIcon className="size-5 text-[var(--flag-green)]" />
                      ) : (
                        <ClockIcon className="size-5 text-[var(--flag-green)]" />
                      )}
                      {s.title}
                    </h2>
                  )}
                  {[...byDay.entries()].map(([day, items]) => (
                    <section
                      key={day}
                      data-day
                      aria-label={day ? longDay.format(asDate(day)) : "Date à fixer"}
                      className="flex flex-col gap-3"
                    >
                      <ListHeading>
                        {day ? longDay.format(asDate(day)) : "Date à fixer"}
                      </ListHeading>
                      <ul className="flex flex-col gap-3">
                        {items.map((i) => (
                          <FixtureRow key={i.key} item={i} showCompetition={!champ} />
                        ))}
                      </ul>
                    </section>
                  ))}
                </section>
              );
            })}
        </div>
      )}
    </FavoritesScope>
  );

  // 8. Accès au calendrier complet de la vue.
  const fullCalendar = (
    <Link
      href={champ ? champ.href : href({ statut: "a-venir", date: undefined })}
      className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline"
    >
      <CalendarIcon className="size-4" />
      {champ ? "Calendrier complet et classement" : "Calendrier complet des matchs à venir"}
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );

  const head = (
    <>
      {categories}
      {live && <LiveRefresh seconds={20} />}
      {statusNav}
      {dateNav}
      {form}
    </>
  );

  if (champ) {
    const c = champ.competition;
    return (
      <div className="flex flex-col gap-5">
        {head}
        <div className="grid gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <section
            aria-labelledby="championnat-title"
            className="flex min-w-0 flex-col gap-6"
          >
            <div className="flex items-stretch gap-3 border-b pb-4">
              <span
                aria-hidden
                className="w-1 shrink-0 bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]"
              />
              <div className="flex flex-col gap-1">
                <h2
                  id="championnat-title"
                  className="text-2xl leading-tight font-bold uppercase sm:text-3xl"
                >
                  <Link href={champ.href} className="hover:text-[var(--flag-green)]">
                    {c.championship?.name ?? c.name}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Saison {seasonLabel(c.season)} · Calendrier et résultats officiels
                  {round && ` · Journée ${round}`}
                </p>
              </div>
            </div>
            {dateNote}
            {list}
            {moreLink}
            {fullCalendar}
          </section>

          <aside
            aria-label="Classement et informations du championnat"
            className="flex flex-col gap-6"
          >
            {table.length > 0 && (
              <SideStandings rows={table} logos={logos} href={champ.href} />
            )}
            <section
              aria-labelledby="prochains-rdv"
              className="flex flex-col gap-4 bg-muted/60 p-4 sm:p-5"
            >
              <h2
                id="prochains-rdv"
                className="flex items-center gap-2.5 font-heading text-lg font-bold uppercase"
              >
                <CalendarIcon className="size-5 text-[var(--flag-green)]" />
                Prochains rendez-vous
              </h2>
              {upcomingNext.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {upcomingNext.map((i) => (
                    <NextFixture key={i.key} item={i} />
                  ))}
                </ul>
              ) : (
                <p className="bg-card p-4 text-sm text-muted-foreground">
                  Aucun match programmé pour le moment.
                </p>
              )}
            </section>
            {scorers.length > 0 && <SideScorers scorers={scorers} />}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {head}
      <div className="grid gap-8 pt-2 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        {/* Compétitions de la vue (ordinateur) : nombre de matchs et direct */}
        <nav
          aria-label="Compétitions"
          className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-1 lg:bg-muted/60 lg:p-2"
        >
          <p className="flex items-center gap-2 px-3 pt-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <TrophyIcon className="size-3.5" />
            Compétitions
          </p>
          <Link
            href={href({ competition: undefined })}
            aria-current={!selectedComp ? "page" : undefined}
            className={side(!selectedComp)}
          >
            Toutes
            <span className="text-xs tabular-nums opacity-70">{total}</span>
          </Link>
          {byComp.national > 0 && (
            <Link
              href={href({ competition: "selections", categorie: undefined })}
              aria-current={selectedComp === "selections" ? "page" : undefined}
              className={side(selectedComp === "selections")}
            >
              <span className="min-w-0 truncate">Équipes nationales</span>
              <span className="text-xs tabular-nums opacity-70">
                {byComp.national}
              </span>
            </Link>
          )}
          {byComp.competitions.map((c) => (
            <Link
              key={c.id}
              href={href({ competition: String(c.id) })}
              aria-current={selectedComp === c.id ? "page" : undefined}
              className={side(selectedComp === c.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {c.live > 0 && (
                  <span
                    aria-label="match en direct"
                    className="size-2 shrink-0 rounded-full bg-[var(--flag-red)] motion-safe:animate-pulse"
                  />
                )}
                <span className="truncate">{c.name}</span>
              </span>
              <span className="text-xs tabular-nums opacity-70">{c.n}</span>
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {dateNote}
          {list}
          {moreLink}
          {fullCalendar}
        </div>
      </div>
    </div>
  );
}
