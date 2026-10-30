import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { ArrowCircle } from "@/components/public/ui";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  COMPETITION_GENDER_LABELS,
  formatLabel,
  GENDERS,
  PUBLIC_STATUS_LABELS,
  publicStatus,
  type CompetitionCategory,
  type PublicStatus,
} from "@/lib/competitions";
import { db } from "@/lib/db";
import {
  championships,
  competitions,
  competitionTeams,
  leagues,
  matches,
} from "@/lib/db/schema";
import { championshipLogoUrl, leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";

export const metadata: Metadata = {
  title: "Compétitions — FECOFOOT",
  description:
    "Calendriers, résultats et classements des compétitions nationales et départementales de la Fédération Congolaise de Football.",
};

const one = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Onglets du portail, dans l'ordre d'affichage des sections. */
const GROUPS: { key: Exclude<PublicStatus, "DRAFT">; title: string }[] = [
  { key: "ONGOING", title: "En cours" },
  { key: "UPCOMING", title: "À venir" },
  { key: "FINISHED", title: "Terminées" },
];

/** Pastille de statut : un point coloré et un libellé (jamais la couleur seule). */
const STATUS_DOT: Record<PublicStatus, string> = {
  ONGOING: "bg-[var(--flag-green)]",
  UPCOMING: "bg-[var(--flag-yellow)]",
  FINISHED: "bg-muted-foreground",
  DRAFT: "bg-muted-foreground",
};

type SearchParams = Awaited<PageProps<"/competitions">["searchParams"]>;

export default function PublicCompetitionsPage({
  searchParams,
}: PageProps<"/competitions">) {
  // Titre et en-tête tout de suite ; la liste arrive dès que la base a répondu.
  return (
    <PublicShell
      eyebrow="Compétitions"
      title="Compétitions"
      subtitle="Divisions nationales, championnats départementaux, coupes, compétitions féminines et de jeunes"
      wide
    >
      <Suspense fallback={<ListSkeleton />}>
        <CompetitionList searchParams={searchParams} />
      </Suspense>
    </PublicShell>
  );
}

/** Pendant le chargement : la forme de la page (filtres, onglets, cartes) plutôt qu'un écran vide. */
function ListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement des compétitions"
      className="flex flex-col gap-6 motion-safe:animate-pulse"
    >
      <div className="h-36 rounded-xl bg-muted/60 sm:h-24" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 rounded-full bg-muted" />
        ))}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-64 rounded-2xl bg-muted/60" />
        ))}
      </ul>
    </div>
  );
}

async function CompetitionList({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const sp = await searchParams;
  const season = Number(one(sp.saison)) || undefined;
  const organiser = one(sp.organisateur);
  const category = COMPETITION_CATEGORIES.find(
    (c) => c === one(sp.categorie),
  ) as CompetitionCategory | undefined;
  const gender = GENDERS.find((g) => g === one(sp.genre)?.toUpperCase());
  const status = GROUPS.find((g) => g.key === one(sp.statut))?.key;

  // Le statut ne filtre pas la requête : les onglets affichent le nombre de compétitions de chaque statut.
  const filters: SQL[] = [ne(competitions.status, "DRAFT")];
  if (season) filters.push(eq(competitions.season, season));
  if (organiser === "national") filters.push(isNull(competitions.leagueId));
  else if (organiser) filters.push(eq(leagues.code, organiser.toUpperCase()));
  if (category) filters.push(eq(competitions.category, category));
  if (gender) filters.push(eq(competitions.gender, gender));

  const [rows, seasons, leagueList] = await Promise.all([
    db
      .select({
        c: competitions,
        league: {
          id: leagues.id,
          name: leagues.name,
          logoKey: leagues.logoKey,
        },
        championship: {
          id: championships.id,
          code: championships.code,
          logoKey: championships.logoKey,
        },
        played: sql<number>`(select count(*)::int from ${matches} where ${matches.competitionId} = ${competitions.id} and ${matches.status} in ('FINISHED', 'LIVE', 'HALF_TIME'))`,
        teams: sql<number>`(select count(*)::int from ${competitionTeams} where ${competitionTeams.competitionId} = ${competitions.id})`,
        pools: sql<number>`(select count(distinct ${competitionTeams.pool})::int from ${competitionTeams} where ${competitionTeams.competitionId} = ${competitions.id})`,
      })
      .from(competitions)
      .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
      .leftJoin(
        championships,
        eq(competitions.championshipId, championships.id),
      )
      .where(and(...filters))
      .orderBy(
        desc(competitions.season),
        asc(championships.tier),
        asc(competitions.name),
      ),
    db
      .selectDistinct({ season: competitions.season })
      .from(competitions)
      .where(ne(competitions.status, "DRAFT"))
      .orderBy(desc(competitions.season)),
    db
      .select({
        code: leagues.code,
        department: leagues.department,
        name: leagues.name,
      })
      .from(leagues)
      .where(eq(leagues.active, true))
      .orderBy(asc(leagues.department)),
  ]);
  const list = rows.map((r) => ({
    ...r,
    status: publicStatus(r.c.status, r.played),
  }));
  const shown = status ? list.filter((r) => r.status === status) : list;
  const filtered = Boolean(season || organiser || category || gender || status);

  // Adresse de la page avec les critères courants, modifiés par `extra`.
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const current = {
      saison: season ? String(season) : undefined,
      organisateur: organiser,
      categorie: category,
      genre: gender,
      statut: status,
    };
    for (const [k, v] of Object.entries({ ...current, ...extra }))
      if (v) q.set(k, v);
    const s = q.toString();
    return `/competitions${s ? `?${s}` : ""}`;
  };
  const tab = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center whitespace-nowrap gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:bg-muted"}`;
  const field =
    "flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const select =
    "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm font-normal normal-case tracking-normal text-foreground";

  const grid = (items: typeof list) => (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ c, league, championship, teams, pools, status: st }) => {
        const logo = championship
          ? championshipLogoUrl(championship)
          : league
            ? leagueLogoUrl(league)
            : null;
        const link = championship
          ? `/championnats/${championship.code}?saison=${c.season}`
          : `/competitions/${c.slug}`;
        return (
          <li key={c.id}>
            <Link
              href={link}
              className="group flex h-full flex-col rounded-2xl bg-muted/60 transition-[border-color,box-shadow,transform] duration-200 hover:border-flag-green/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-0.5 hover:bg-muted"
            >
              <div className="flex items-start gap-4 p-5">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
                  <img
                    src={logo}
                    alt=""
                    className="size-14 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="h-14 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {league?.name ?? "Fédération · nationale"}
                  </span>
                  <h3 className="font-display text-xl leading-tight font-bold uppercase">
                    {c.name}
                  </h3>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-5 py-4 text-sm">
                {(
                  [
                    ["Saison", seasonLabel(c.season)],
                    [
                      "Catégorie",
                      `${COMPETITION_CATEGORY_LABELS[c.category]} · ${COMPETITION_GENDER_LABELS[c.gender]}`,
                    ],
                    ["Format", formatLabel(c, pools)],
                    [
                      "Clubs",
                      teams > 0
                        ? `${teams} engagé${teams > 1 ? "s" : ""}`
                        : "À publier",
                    ],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex items-center justify-between gap-3 border-t px-5 py-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${STATUS_DOT[st]}`}
                  />
                  {PUBLIC_STATUS_LABELS[st]}
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  Voir la compétition <ArrowCircle />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        action="/competitions"
        className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
        aria-label="Filtrer les compétitions"
      >
        {status && <input type="hidden" name="statut" value={status} />}
        <label className={field}>
          Saison
          <select name="saison" defaultValue={season ?? ""} className={select}>
            <option value="">Toutes</option>
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {seasonLabel(s.season)}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Organisateur
          <select
            name="organisateur"
            defaultValue={organiser ?? ""}
            className={select}
          >
            <option value="">Tous</option>
            <option value="national">
              Fédération (compétitions nationales)
            </option>
            <optgroup label="Ligues départementales">
              {leagueList.map((l) => (
                <option key={l.code} value={l.code.toLowerCase()}>
                  {l.department ?? l.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className={field}>
          Catégorie
          <select
            name="categorie"
            defaultValue={category ?? ""}
            className={select}
          >
            <option value="">Toutes</option>
            {COMPETITION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COMPETITION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Masculin / féminin
          <select name="genre" defaultValue={gender ?? ""} className={select}>
            <option value="">Tous</option>
            {GENDERS.map((g) => (
              <option key={g} value={g.toLowerCase()}>
                {COMPETITION_GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex gap-2 lg:col-span-1">
          <button
            type="submit"
            className="h-10 flex-1 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green lg:flex-none"
          >
            Filtrer
          </button>
          {filtered && (
            <Link
              href="/competitions"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border px-4 text-sm font-semibold hover:bg-muted lg:flex-none"
            >
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      <nav
        aria-label="Statut des compétitions"
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-2">
          {[{ key: undefined, title: "Toutes" }, ...GROUPS].map((g) => {
            const count = g.key
              ? list.filter((r) => r.status === g.key).length
              : list.length;
            return (
              <li key={g.title}>
                <Link
                  href={href({ statut: g.key })}
                  className={tab(status === g.key)}
                  aria-current={status === g.key ? "page" : undefined}
                >
                  {g.title}
                  <span
                    className={`rounded-full px-1.5 text-xs tabular-nums ${status === g.key ? "bg-white/20" : "bg-muted"}`}
                  >
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p role="status" className="text-sm text-muted-foreground">
        {shown.length === 0
          ? "Aucune compétition"
          : `${shown.length} compétition${shown.length > 1 ? "s" : ""}`}
        {filtered ? " pour ces critères" : " publiées"}
      </p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {filtered
              ? "Aucune compétition publiée ne correspond à ces critères."
              : "Aucune compétition n'est encore publiée. Les calendriers apparaîtront ici dès leur publication."}
          </p>
          {filtered && (
            <Link
              href="/competitions"
              className="rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Voir toutes les compétitions
            </Link>
          )}
        </div>
      ) : status ? (
        grid(shown)
      ) : (
        <div className="flex flex-col gap-10">
          {GROUPS.map((g) => {
            const items = shown.filter((r) => r.status === g.key);
            if (items.length === 0) return null;
            return (
              <section
                key={g.key}
                className="flex flex-col gap-4"
                aria-labelledby={`groupe-${g.key}`}
              >
                <h2
                  id={`groupe-${g.key}`}
                  className="border-b-2 border-foreground pb-2 text-2xl font-bold uppercase"
                >
                  {g.title}
                </h2>
                {grid(items)}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
