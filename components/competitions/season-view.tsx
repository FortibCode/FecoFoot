import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { MatchLine } from "@/components/competitions/match-line";
import { PaginatedStandings } from "@/components/competitions/paginated-standings";
import { ScorersList } from "@/components/competitions/standings-table";
import { ClubLogo } from "@/components/public/club-logo";
import { LiveRefresh } from "@/components/live-refresh";
import { clubLogos } from "@/lib/club-logos";
import { formatLabel, isLive, parseTiebreakers, roundLabel, TEAM_OUTCOME_LABELS, TIEBREAKER_LABELS } from "@/lib/competitions";
import type { competitions } from "@/lib/db/schema";
import { matches } from "@/lib/db/schema";
import { seasonTeams } from "@/lib/queries/championships";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

type Competition = typeof competitions.$inferSelect;

export function Empty({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}

/** Données publiques d'une saison : classements, buteurs, rencontres, clubs engagés et leurs logos. */
export async function loadSeason(competitionId: number) {
  const [tables, allMatches, teams] = await Promise.all([
    competitionTables(competitionId),
    matchQuery().where(eq(matches.competitionId, competitionId)).orderBy(asc(matches.round), asc(matches.bracketSlot), asc(matches.kickoffAt), asc(matches.id)),
    seasonTeams(competitionId),
  ]);
  const pools = [...new Set(teams.map((t) => t.pool).filter((p): p is string => Boolean(p)))].sort();
  return { tables: tables?.tables ?? [], scorers: tables?.scorers ?? [], matches: allMatches, teams, pools, logos: await clubLogos(teams.map((t) => t.clubId)) };
}
export type SeasonData = Awaited<ReturnType<typeof loadSeason>>;

/** Règlement sportif tel que configuré par l'organisateur : format, barème, départage, montées, suspensions. */
export function CompetitionFacts({ c, pools, poolLabel = "poule" }: { c: Competition; pools: number; poolLabel?: string }) {
  const facts: [string, string][] = [["Format", formatLabel(c, pools)]];
  if (c.type === "LEAGUE") {
    facts.push(["Barème", `Victoire ${c.pointsWin} pts · Nul ${c.pointsDraw} pt${c.pointsDraw > 1 ? "s" : ""} · Défaite ${c.pointsLoss} pt`]);
    facts.push(["Départage à égalité de points", parseTiebreakers(c.tiebreakers).map((t) => TIEBREAKER_LABELS[t]).join(", puis ")]);
    if (c.promotionSpots > 0 || c.relegationSpots > 0)
      facts.push(["Montées et descentes", `${c.promotionSpots} montée(s) · ${c.relegationSpots} descente(s)${pools > 1 ? ` par ${poolLabel}` : ""}`]);
  }
  facts.push(["Discipline", `Suspension automatique après ${c.yellowCardThreshold} avertissements`]);
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2">
      {facts.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Corps public d'une saison, adapté au format : championnat (classement, journées) ou coupe (tableau
 * par tour). `pool` restreint l'affichage à une poule (zone d'un championnat national).
 */
export function SeasonView({ c, data, pool, poolLabel = "Poule" }: { c: Competition; data: SeasonData; pool?: string; poolLabel?: string }) {
  const cup = c.type === "CUP";
  const tables = data.tables.filter((t) => !pool || t.pool === pool);
  const allMatches = data.matches.filter((m) => !pool || m.match.pool === pool);
  const teams = data.teams.filter((t) => !pool || t.pool === pool);
  const logos = Object.fromEntries(data.logos);
  const live = allMatches.filter((m) => isLive(m.match.status));
  const played = allMatches.filter((m) => m.match.status === "FINISHED" && m.match.validatedAt);
  const results = [...played].reverse().slice(0, 8);
  const goals = played.reduce((a, m) => a + (m.match.homeScore ?? 0) + (m.match.awayScore ?? 0), 0);
  const rounds = [...new Set(allMatches.map((m) => m.match.round))];
  const totalRounds = Math.max(0, ...rounds);
  // Tour affiché d'emblée : le premier encore incomplet, sinon le dernier.
  const openRound = rounds.find((r) => allMatches.some((m) => m.match.round === r && m.match.status !== "FINISHED" && m.match.status !== "CANCELLED")) ?? rounds.at(-1);

  return (
    <>
      {live.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="direct">
          <h2 id="direct" className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-[var(--flag-red,#dc241f)]" /> En direct
          </h2>
          <LiveRefresh />
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {live.map((m) => (
              <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {cup ? (
            <>
              <h2 className="text-lg font-bold">Tableau</h2>
              {rounds.length === 0 ? (
                <Empty>Le tableau apparaîtra après le tirage au sort.</Empty>
              ) : (
                rounds.map((r) => (
                  <details key={r} open={r === openRound} className="overflow-hidden rounded-lg border bg-card">
                    <summary className="cursor-pointer border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">{roundLabel(r, totalRounds)}</summary>
                    <div className="divide-y">
                      {allMatches
                        .filter((m) => m.match.round === r)
                        .map((m) => (
                          <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
                        ))}
                    </div>
                  </details>
                ))
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">Classement</h2>
              {tables.length === 0 || teams.length === 0 ? (
                <Empty>Le classement apparaîtra avec les premiers résultats officiels.</Empty>
              ) : (
                tables.map((t) => (
                  <PaginatedStandings
                    key={t.pool}
                    rows={t.rows}
                    title={t.pool ? `${poolLabel} ${t.pool}` : undefined}
                    logos={logos}
                    zones={{ promotion: c.promotionSpots, relegation: c.relegationSpots }}
                  />
                ))
              )}
            </>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          <h2 className="text-lg font-bold">Statistiques</h2>
          <dl className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-4 text-center">
            {(
              [
                ["Matchs joués", played.length],
                ["Buts", goals],
                ["Buts / match", played.length ? (goals / played.length).toFixed(1).replace(".", ",") : "—"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-heading text-2xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="font-semibold">Meilleurs buteurs</h3>
          <ScorersList scorers={data.scorers} />
        </aside>
      </section>

      {!cup && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Calendrier par journée</h2>
          {rounds.length === 0 ? (
            <Empty>Le calendrier de la saison n&apos;est pas encore publié.</Empty>
          ) : (
            rounds.map((r) => (
              <details key={r} open={r === openRound} className="overflow-hidden rounded-lg border bg-card">
                <summary className="cursor-pointer border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">Journée {r}</summary>
                <div className="divide-y">
                  {allMatches
                    .filter((m) => m.match.round === r)
                    .map((m) => (
                      <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
                    ))}
                </div>
              </details>
            ))
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Derniers résultats</h2>
        {results.length === 0 ? (
          <Empty>Aucun résultat officiel pour cette saison.</Empty>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {results.map((m) => (
              <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Clubs participants · {teams.length}</h2>
        {teams.length === 0 ? (
          <Empty>Les clubs participants de la saison ne sont pas encore publiés.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => (
              <li key={t.clubId}>
                <Link
                  href={`/clubs/${t.slug}`}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-0.5"
                >
                  <ClubLogo src={data.logos.get(t.clubId)} name={t.name} className="size-16" />
                  <span className="font-display leading-tight font-bold uppercase">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{[t.city, t.pool && `${poolLabel} ${t.pool}`].filter(Boolean).join(" · ")}</span>
                  {t.league && <span className="text-xs text-muted-foreground">{t.league}</span>}
                  {t.outcome && <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{TEAM_OUTCOME_LABELS[t.outcome]}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
