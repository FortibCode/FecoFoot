import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { COMPETITION_CATEGORIES, COMPETITION_CATEGORY_LABELS, type CompetitionCategory, type CompetitionStatus } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, leagues, matches } from "@/lib/db/schema";
import { seasonLabel } from "@/lib/licenses";

export const metadata: Metadata = {
  title: "Compétitions — FECOFOOT",
  description: "Calendriers, résultats et classements des compétitions nationales et départementales de la Fédération Congolaise de Football.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Regroupement du portail : « à venir » = publiée, calendrier connu, aucun match encore joué. */
type Group = "UPCOMING" | CompetitionStatus;
const GROUPS: { key: Group; title: string }[] = [
  { key: "ONGOING", title: "En cours" },
  { key: "UPCOMING", title: "À venir" },
  { key: "FINISHED", title: "Terminées" },
];
const groupOf = (status: CompetitionStatus, played: number): Group => (status === "ONGOING" && played === 0 ? "UPCOMING" : status);

export default async function PublicCompetitionsPage({ searchParams }: PageProps<"/competitions">) {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const sp = await searchParams;
  const season = Number(one(sp.saison)) || undefined;
  const organiser = one(sp.organisateur);
  const category = COMPETITION_CATEGORIES.find((c) => c === one(sp.categorie)) as CompetitionCategory | undefined;
  const status = GROUPS.find((g) => g.key === one(sp.statut))?.key;

  const filters: SQL[] = [ne(competitions.status, "DRAFT")];
  if (season) filters.push(eq(competitions.season, season));
  if (organiser === "national") filters.push(isNull(competitions.leagueId));
  else if (organiser) filters.push(eq(leagues.code, organiser.toUpperCase()));
  if (category) filters.push(eq(competitions.category, category));
  if (status) filters.push(eq(competitions.status, status === "UPCOMING" ? "ONGOING" : status));

  const [rows, seasons, leagueList] = await Promise.all([
    db
      .select({
        c: competitions,
        league: { name: leagues.name, code: leagues.code },
        played: sql<number>`(select count(*)::int from ${matches} where ${matches.competitionId} = ${competitions.id} and ${matches.status} in ('FINISHED', 'LIVE', 'HALF_TIME'))`,
      })
      .from(competitions)
      .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
      .where(and(...filters))
      .orderBy(desc(competitions.season), asc(competitions.name)),
    db.selectDistinct({ season: competitions.season }).from(competitions).where(ne(competitions.status, "DRAFT")).orderBy(desc(competitions.season)),
    db.select({ code: leagues.code, name: leagues.name }).from(leagues).where(eq(leagues.active, true)).orderBy(asc(leagues.name)),
  ]);
  const select = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";

  return (
    <PublicShell eyebrow="Compétitions" title="Compétitions" subtitle="Divisions nationales, championnats départementaux, coupes, compétitions féminines et de jeunes" wide>
      <form className="mb-8 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end" aria-label="Filtres">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Organisateur
          <select name="organisateur" defaultValue={organiser ?? ""} className={select}>
            <option value="">Tous</option>
            <option value="national">Fédération (nationales)</option>
            {leagueList.map((l) => (
              <option key={l.code} value={l.code.toLowerCase()}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Catégorie
          <select name="categorie" defaultValue={category ?? ""} className={select}>
            <option value="">Toutes</option>
            {COMPETITION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COMPETITION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Statut
          <select name="statut" defaultValue={status ?? ""} className={select}>
            <option value="">Tous</option>
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white">
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Aucune compétition publiée ne correspond à ces critères.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {GROUPS.map((g) => {
            const list = rows.filter((r) => groupOf(r.c.status, r.played) === g.key && (!status || status === g.key));
            if (list.length === 0) return null;
            return (
              <section key={g.key} className="flex flex-col gap-4">
                <h2 className="border-b-2 border-foreground pb-2 text-2xl font-bold uppercase">{g.title}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map(({ c, league }) => (
                    <li key={c.id}>
                      <Link href={`/competitions/${c.slug}`} className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--flag-green,#009543)]">{league?.name ?? "Fédération — nationale"}</span>
                        <span className="font-heading text-lg leading-tight font-bold uppercase">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {seasonLabel(c.season)} · {COMPETITION_CATEGORY_LABELS[c.category]}
                          {c.gender === "F" ? " · Féminin" : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
