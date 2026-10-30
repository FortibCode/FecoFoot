import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { FixtureGroups } from "@/components/matches/fixture-groups";
import type { FixtureItem } from "@/components/matches/match-card";
import { PublicShell } from "@/components/public/public-shell";
import { MATCH_FAMILIES, PUBLIC_MATCH_STATUS_LABELS, PUBLIC_MATCH_STATUSES, type MatchFamily, type PublicMatchStatus } from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import { addDays, familyTabs, fixtureCounts, fixtureFilterOptions, fixturesByDay, publicFixtures, withFamily, type MatchFilters } from "@/lib/queries/matches";

export const metadata: Metadata = {
  title: "Matchs et résultats — FECOFOOT",
  description: "Matchs en direct, calendrier et résultats officiels des compétitions de la Fédération Congolaise de Football et des Diables Rouges.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Statut dans l'adresse (en français) ; les anciennes vues « résultats / calendrier / direct » restent valables. */
const STATUS_SLUGS: Record<PublicMatchStatus, string> = {
  LIVE: "direct",
  UPCOMING: "a-venir",
  FINISHED: "termines",
  POSTPONED: "reportes",
  SUSPENDED: "suspendus",
  CANCELLED: "annules",
};
const LEGACY_VIEWS: Record<string, PublicMatchStatus> = { resultats: "FINISHED", calendrier: "UPCOMING", direct: "LIVE" };
const TAB_LABELS: Record<PublicMatchStatus, string> = { ...PUBLIC_MATCH_STATUS_LABELS, FINISHED: "Résultats", POSTPONED: "Reportés", SUSPENDED: "Suspendus", CANCELLED: "Annulés" };
const PAGE = 40;

const today = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
const longDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
const dayKey = (d: Date | null) => (d ? new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10) : "");

type SearchParams = Awaited<PageProps<"/matchs">["searchParams"]>;

export default function PublicMatchesPage({ searchParams }: PageProps<"/matchs">) {
  return (
    <PublicShell eyebrow="Compétitions" title="Matchs et résultats" subtitle="En direct, calendrier et résultats officiels du football congolais, clubs et sélections nationales" wide>
      <Suspense fallback={<Skeleton />}>
        <Matches searchParams={searchParams} />
      </Suspense>
    </PublicShell>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Chargement des matchs" className="flex flex-col gap-6 motion-safe:animate-pulse">
      <div className="h-11 w-full max-w-2xl rounded-full bg-muted" />
      <div className="h-20 rounded-xl border bg-card" />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="h-6 w-56 rounded bg-muted" />
          <div className="h-48 rounded-2xl border bg-card" />
        </div>
      ))}
    </div>
  );
}

/** Rencontres d'un jour, regroupées par compétition et journée (ou sélection). */
function DayBlock({ day, items }: { day: string; items: FixtureItem[] }) {
  return (
    <section aria-label={day ? longDay.format(asDate(day)) : "Date à fixer"} className="flex flex-col gap-3">
      <h3 className="font-heading text-lg font-bold first-letter:uppercase">{day ? longDay.format(asDate(day)) : "Date à fixer"}</h3>
      <FixtureGroups items={items} />
    </section>
  );
}

async function Matches({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Liste vivante : calculée à chaque visite.
  await connection();
  const sp = await searchParams;
  const rawComp = one(sp.competition);
  const status = (Object.keys(STATUS_SLUGS) as PublicMatchStatus[]).find((s) => STATUS_SLUGS[s] === one(sp.statut)) ?? LEGACY_VIEWS[one(sp.vue) ?? ""];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date) ?? "") && !Number.isNaN(asDate(one(sp.date)!).getTime()) ? one(sp.date) : undefined;
  const family = MATCH_FAMILIES.find((f) => f === one(sp.categorie)) as MatchFamily | undefined;
  const filters: MatchFilters = await withFamily({
    family,
    competition: rawComp === "selections" ? "selections" : Number(rawComp) || undefined,
    season: Number(one(sp.saison)) || undefined,
    club: Number(one(sp.equipe)) || undefined,
    status,
    date,
  });
  const limit = Math.min(400, Math.max(PAGE, Number(one(sp.nombre)) || PAGE));
  const weekStart = addDays(date ?? today(), -3);

  const [{ sections }, { counts, stale }, days, options, families] = await Promise.all([
    publicFixtures(filters, limit),
    fixtureCounts(filters),
    fixturesByDay(filters, weekStart),
    fixtureFilterOptions(),
    familyTabs(),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) + stale;
  const live = sections.some((s) => s.items.some((i) => i.status === "LIVE"));
  const more = sections.some((s) => s.more);
  const filtered = Boolean(family || rawComp || filters.season || filters.club || status || date);

  // Adresse de la page avec les critères courants, modifiés par `extra`.
  const href = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const current = {
      categorie: family,
      competition: rawComp && filters.competition && !(family === "selections" && rawComp !== "selections") ? String(rawComp) : undefined,
      saison: filters.season ? String(filters.season) : undefined,
      equipe: filters.club ? String(filters.club) : undefined,
      statut: status ? STATUS_SLUGS[status] : undefined,
      date,
    };
    for (const [k, v] of Object.entries({ ...current, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return `/matchs${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:bg-muted"}`;
  const field = "flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const select = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm font-normal normal-case tracking-normal text-foreground";

  return (
    <div className="flex flex-col gap-6">
      {live && <LiveRefresh seconds={20} />}

      {/* Statuts, avec le nombre de rencontres de chacun */}
      <nav aria-label="Statut des matchs" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {[undefined, ...PUBLIC_MATCH_STATUSES].map((s) => (
            <li key={s ?? "all"}>
              <Link href={href({ statut: s ? STATUS_SLUGS[s] : undefined })} className={chip(status === s)} aria-current={status === s ? "page" : undefined}>
                {s === "LIVE" && counts.LIVE > 0 && <span aria-hidden className="size-2 rounded-full bg-[var(--flag-red)] motion-safe:animate-pulse" />}
                {s ? TAB_LABELS[s] : "Tous"}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${status === s ? "bg-white/20" : "bg-muted"}`}>{s ? counts[s] : total}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Navigation par date : une semaine, flèches pour la précédente et la suivante */}
      <nav aria-label="Navigation par date" className="flex items-center gap-2">
        <Link href={href({ date: addDays(weekStart, -4) })} aria-label="Semaine précédente" className="grid size-11 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted">
          ←
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
                  className={`flex flex-col items-center rounded-xl border px-0.5 py-2 text-center transition-colors ${active ? "border-brand-ink bg-brand-ink text-white" : count > 0 ? "bg-card hover:bg-muted" : "bg-card/50 text-muted-foreground hover:bg-muted"}`}
                >
                  <span className="text-[0.65rem] font-semibold uppercase">{isToday ? "Auj." : weekday.format(asDate(day)).replace(".", "")}</span>
                  <span className="font-heading text-sm font-bold whitespace-nowrap sm:text-base">
                    <span className="sm:hidden">{asDate(day).getUTCDate()}</span>
                    <span className="hidden sm:inline">{dayNum.format(asDate(day)).replace(".", "")}</span>
                  </span>
                  <span aria-hidden className={`mt-1 size-1.5 rounded-full ${count > 0 ? (active ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-green)]") : "bg-transparent"}`} />
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href={href({ date: addDays(weekStart, 10) })} aria-label="Semaine suivante" className="grid size-11 shrink-0 place-items-center rounded-full border bg-card hover:bg-muted">
          →
        </Link>
      </nav>

      <form action="/matchs" aria-label="Filtrer les matchs" className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        {status && <input type="hidden" name="statut" value={STATUS_SLUGS[status]} />}
        {date && <input type="hidden" name="date" value={date} />}
        <label className={field}>
          Catégorie
          <select name="categorie" defaultValue={family ?? ""} className={select}>
            <option value="">Toutes</option>
            {families.map((f) => (
              <option key={f.family} value={f.family}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Compétition
          <select name="competition" defaultValue={rawComp ?? ""} className={select}>
            <option value="">Toutes</option>
            <option value="selections">Équipes nationales (Diables Rouges)</option>
            {options.comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({seasonLabel(c.season)})
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Saison
          <select name="saison" defaultValue={filters.season ?? ""} className={select}>
            <option value="">Toutes</option>
            {options.seasons.map((s) => (
              <option key={s} value={s}>
                {seasonLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Équipe
          <select name="equipe" defaultValue={filters.club ?? ""} className={select}>
            <option value="">Toutes</option>
            {options.clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex gap-2 lg:col-span-1">
          <button type="submit" className="h-10 flex-1 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green lg:flex-none">
            Filtrer
          </button>
          {filtered && (
            <Link href="/matchs" className="inline-flex h-10 flex-1 items-center justify-center rounded-md border px-4 text-sm font-semibold hover:bg-muted lg:flex-none">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      {date && (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Matchs du <strong>{longDay.format(asDate(date))}</strong>
          </span>
          <Link href={href({ date: undefined })} className="font-semibold text-flag-green underline-offset-4 hover:underline">
            Toutes les dates
          </Link>
        </p>
      )}

      {sections.every((s) => s.items.length === 0) ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-semibold">
            {date ? "Aucun match ce jour-là." : status === "LIVE" ? "Aucun match en cours." : filtered ? "Aucun match ne correspond à ces critères." : "Aucun match publié pour le moment."}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">Les calendriers apparaissent ici dès leur publication par les organisateurs ; les scores, en direct, sur saisie officielle.</p>
          {filtered && (
            <Link href="/matchs" className="rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
              Voir tous les matchs
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sections
            .filter((s) => s.items.length > 0)
            .map((s) => {
              const byDay = new Map<string, FixtureItem[]>();
              for (const i of s.items) byDay.set(dayKey(i.kickoffAt), [...(byDay.get(dayKey(i.kickoffAt)) ?? []), i]);
              return (
                <section key={s.key} aria-labelledby={s.title ? `section-${s.key}` : undefined} className="flex flex-col gap-6">
                  {s.title && (
                    <h2 id={`section-${s.key}`} className="border-b-2 border-foreground pb-2 text-2xl font-bold uppercase">
                      {s.title}
                    </h2>
                  )}
                  {[...byDay.entries()].map(([day, items]) => (
                    <DayBlock key={day} day={day} items={items} />
                  ))}
                </section>
              );
            })}
        </div>
      )}

      {more && (
        <div className="flex justify-center">
          <Link href={href({ nombre: String(limit + PAGE) })} scroll={false} className="rounded-md border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted">
            Voir plus de matchs
          </Link>
        </div>
      )}
    </div>
  );
}
