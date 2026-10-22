import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, isNotNull, ne, type SQL } from "drizzle-orm";
import { MatchLine } from "@/components/competitions/match-line";
import { LiveRefresh } from "@/components/live-refresh";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { competitions, matches } from "@/lib/db/schema";
import { seasonLabel } from "@/lib/licenses";
import { matchQuery } from "@/lib/queries/competitions";

export const metadata: Metadata = {
  title: "Matchs — FECOFOOT",
  description: "Matchs en direct, calendrier et résultats officiels de toutes les compétitions de la Fédération Congolaise de Football.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const VIEWS = [
  { key: "resultats", title: "Résultats" },
  { key: "calendrier", title: "Calendrier" },
  { key: "direct", title: "En direct" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Tous les matchs publiés : en direct, à venir, résultats officiels (validés), par compétition. */
export default async function PublicMatchesPage({ searchParams }: PageProps<"/matchs">) {
  await connection();
  const sp = await searchParams;
  const view: View = VIEWS.find((v) => v.key === one(sp.vue))?.key ?? "resultats";
  const competitionId = Number(one(sp.competition)) || undefined;

  const filters: SQL[] = [ne(competitions.status, "DRAFT")];
  if (competitionId) filters.push(eq(matches.competitionId, competitionId));
  if (view === "resultats") filters.push(eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt));
  if (view === "calendrier") filters.push(eq(matches.status, "SCHEDULED"), gte(matches.kickoffAt, new Date()));
  if (view === "direct") filters.push(inArray(matches.status, ["LIVE", "HALF_TIME"]));

  const [rows, comps] = await Promise.all([
    matchQuery()
      .where(and(...filters))
      .orderBy(view === "resultats" ? desc(matches.kickoffAt) : asc(matches.kickoffAt))
      .limit(100),
    db
      .select({ id: competitions.id, name: competitions.name, season: competitions.season })
      .from(competitions)
      .where(ne(competitions.status, "DRAFT"))
      .orderBy(desc(competitions.season), asc(competitions.name)),
  ]);
  const href = (v: View) => `/matchs?vue=${v}${competitionId ? `&competition=${competitionId}` : ""}`;
  const select = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";

  return (
    <PublicShell eyebrow="Compétitions" title="Matchs" subtitle="En direct, calendrier et résultats officiels" wide>
      <div className="flex flex-col gap-6">
        <nav aria-label="Vues" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(v.key)}
              aria-current={view === v.key ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${view === v.key ? "bg-brand-ink text-white" : "bg-card hover:bg-muted"}`}
            >
              {v.title}
            </Link>
          ))}
        </nav>

        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" aria-label="Filtres">
          <input type="hidden" name="vue" value={view} />
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Compétition
            <select name="competition" defaultValue={competitionId ?? ""} className={select}>
              <option value="">Toutes</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({seasonLabel(c.season)})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-10 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white">
            Filtrer
          </button>
        </form>

        {view === "direct" && rows.length > 0 && <LiveRefresh seconds={20} />}
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            {view === "direct" ? "Aucun match en cours." : view === "calendrier" ? "Aucun match programmé." : "Aucun résultat officiel."}
          </p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {rows.map((r) => (
              <MatchLine key={r.match.id} row={r} href={`/matchs/${r.match.id}`} official showCompetition={!competitionId} />
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
