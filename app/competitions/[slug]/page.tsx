import type { Metadata } from "next";
import { and, asc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MatchLine } from "@/components/competitions/match-line";
import { ScorersList } from "@/components/competitions/standings-table";
import { PaginatedStandings } from "@/components/competitions/paginated-standings";
import { clubLogos } from "@/lib/club-logos";
import { PublicShell } from "@/components/public/public-shell";
import { roundLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, matches } from "@/lib/db/schema";
import { CATEGORY_LABELS, seasonLabel } from "@/lib/licenses";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

async function load(slug: string) {
  const [c] = await db.select().from(competitions).where(and(eq(competitions.slug, slug), ne(competitions.status, "DRAFT"))).limit(1);
  return c ?? null;
}

export async function generateMetadata({ params }: PageProps<"/competitions/[slug]">): Promise<Metadata> {
  const c = await load((await params).slug);
  return c ? { title: `${c.name} — FECOFOOT`, description: `Calendrier, résultats et classement — ${c.name}, saison ${seasonLabel(c.season)}.` } : {};
}

/** Calendrier, résultats, classement détaillé et meilleurs buteurs (EF-PUB-03). */
export default async function PublicCompetitionPage({ params }: PageProps<"/competitions/[slug]">) {
  const c = await load((await params).slug);
  if (!c) notFound();
  const [data, allMatches] = await Promise.all([
    competitionTables(c.id),
    matchQuery().where(eq(matches.competitionId, c.id)).orderBy(asc(matches.round), asc(matches.bracketSlot), asc(matches.kickoffAt)),
  ]);
  const logos = Object.fromEntries(await clubLogos(data?.tables.flatMap((t) => t.rows.map((r) => r.clubId)) ?? []));
  const rounds = [...new Set(allMatches.map((m) => m.match.round))];
  const totalRounds = Math.max(0, ...rounds);

  return (
    <PublicShell eyebrow={`${seasonLabel(c.season)} · ${CATEGORY_LABELS[c.category]}`} subtitle={`${seasonLabel(c.season)} · ${CATEGORY_LABELS[c.category]}`} title={c.name} wide>
      <div className="flex flex-col gap-8">
        {c.type === "LEAGUE" && data && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="text-lg font-bold">Classement</h2>
              {data.tables.map((t) => (
                <PaginatedStandings key={t.pool} rows={t.rows} title={t.pool ? `Poule ${t.pool}` : undefined} logos={logos} />
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="text-lg font-bold">Meilleurs buteurs</h2>
              <ScorersList scorers={data.scorers} />
            </div>
          </section>
        )}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">{c.type === "CUP" ? "Tableau" : "Calendrier et résultats"}</h2>
          {rounds.map((r) => (
            <div key={r} className="overflow-hidden rounded-lg border">
              <p className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
                {c.type === "CUP" ? roundLabel(r, totalRounds) : `Journée ${r}`}
              </p>
              <div className="divide-y">
                {allMatches
                  .filter((m) => m.match.round === r)
                  .map((m) => (
                    <MatchLine key={m.match.id} row={m} />
                  ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </PublicShell>
  );
}
