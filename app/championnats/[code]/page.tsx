import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { MatchLine } from "@/components/competitions/match-line";
import { PaginatedStandings } from "@/components/competitions/paginated-standings";
import { ScorersList } from "@/components/competitions/standings-table";
import { ClubLogo } from "@/components/public/club-logo";
import { PublicShell } from "@/components/public/public-shell";
import { clubLogos } from "@/lib/club-logos";
import { COMPETITION_CATEGORY_LABELS, COMPETITION_STATUS_LABELS, isLive, TEAM_OUTCOME_LABELS } from "@/lib/competitions";
import { matches } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { championshipByCode, championshipDocumentsOf, championshipOfficialsOf, championshipSeason, seasonTeams } from "@/lib/queries/championships";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export async function generateMetadata({ params }: PageProps<"/championnats/[code]">): Promise<Metadata> {
  const ch = await championshipByCode((await params).code);
  return ch?.active ? { title: `${ch.name} — FECOFOOT`, description: `${ch.name} : clubs, calendrier, résultats, classement et statistiques.` } : {};
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}

/** Championnat national (Ligue 1, Ligue 2) : saison choisie, zones ou groupes, calendrier, résultats, classement. */
export default async function PublicChampionshipPage({ params, searchParams }: PageProps<"/championnats/[code]">) {
  const ch = await championshipByCode((await params).code);
  if (!ch?.active) notFound();
  const sp = await searchParams;
  // Une saison en préparation est visible (clubs engagés connus) ; son statut est affiché sous le titre.
  const { editions, current } = await championshipSeason(ch.id, Number(one(sp.saison)) || undefined);
  const [officials, documents] = await Promise.all([championshipOfficialsOf(ch.id), championshipDocumentsOf(ch.id, { published: true })]);
  const active = officials.filter((o) => o.status === "ACTIVE");

  const data = current
    ? await Promise.all([
        competitionTables(current.id),
        matchQuery().where(eq(matches.competitionId, current.id)).orderBy(asc(matches.round), asc(matches.kickoffAt), asc(matches.id)),
        seasonTeams(current.id),
      ])
    : null;
  const pools = data ? [...new Set(data[2].map((t) => t.pool).filter((p): p is string => Boolean(p)))].sort() : [];
  const zone = pools.find((p) => p === one(sp.zone)?.toUpperCase());
  const tables = data?.[0]?.tables.filter((t) => !zone || t.pool === zone) ?? [];
  const allMatches = (data?.[1] ?? []).filter((m) => !zone || m.match.pool === zone);
  const teams = (data?.[2] ?? []).filter((t) => !zone || t.pool === zone);
  const logos = await clubLogos(teams.map((t) => t.clubId));
  const live = allMatches.filter((m) => isLive(m.match.status));
  const results = allMatches.filter((m) => m.match.status === "FINISHED" && m.match.validatedAt).reverse().slice(0, 8);
  const rounds = [...new Set(allMatches.map((m) => m.match.round))];
  // Journée affichée : la première encore incomplète, sinon la dernière.
  const openRound = rounds.find((r) => allMatches.some((m) => m.match.round === r && m.match.status !== "FINISHED" && m.match.status !== "CANCELLED")) ?? rounds.at(-1);
  const played = allMatches.filter((m) => m.match.status === "FINISHED" && m.match.validatedAt);
  const goals = played.reduce((a, m) => a + (m.match.homeScore ?? 0) + (m.match.awayScore ?? 0), 0);
  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ saison: current ? String(current.season) : undefined, zone, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return `/championnats/${ch.code}${s ? `?${s}` : ""}`;
  };
  const chip = (activeChip: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activeChip ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:bg-muted"}`;

  return (
    <PublicShell
      eyebrow="Compétitions nationales"
      title={ch.name}
      subtitle={current ? `Saison ${seasonLabel(current.season)} · ${COMPETITION_CATEGORY_LABELS[current.category]} · ${COMPETITION_STATUS_LABELS[current.status]}` : "Championnat national"}
      wide
    >
      <div className="flex flex-col gap-10">
        {/* Saisons (historique) et zones / groupes de la saison */}
        <nav aria-label="Saisons et zones" className="flex flex-col gap-3">
          {editions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saison</span>
              {editions.map((e) => (
                <Link key={e.id} href={`/championnats/${ch.code}?saison=${e.season}`} className={chip(e.id === current?.id)} aria-current={e.id === current?.id ? "page" : undefined}>
                  {seasonLabel(e.season)}
                </Link>
              ))}
            </div>
          )}
          {pools.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone</span>
              <Link href={query({ zone: undefined })} className={chip(!zone)}>
                Toutes
              </Link>
              {pools.map((p) => (
                <Link key={p} href={query({ zone: p })} className={chip(zone === p)} aria-current={zone === p ? "page" : undefined}>
                  Zone {p}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {!current ? (
          <Empty>Aucune saison n&apos;est encore ouverte pour ce championnat. Le calendrier et les clubs participants apparaîtront ici dès leur publication.</Empty>
        ) : (
          <>
            {live.length > 0 && (
              <section className="flex flex-col gap-3" aria-labelledby="direct">
                <h2 id="direct" className="flex items-center gap-2 text-lg font-bold">
                  <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-[var(--flag-red,#dc241f)]" /> En direct
                </h2>
                <p className="text-xs text-muted-foreground">Scores saisis par les officiels sur la feuille de match.</p>
                <div className="divide-y overflow-hidden rounded-lg border bg-card">
                  {live.map((m) => (
                    <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
                  ))}
                </div>
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-4">
                <h2 className="text-lg font-bold">Classement</h2>
                {tables.length === 0 || teams.length === 0 ? (
                  <Empty>Le classement apparaîtra avec les premiers résultats officiels.</Empty>
                ) : (
                  tables.map((t) => (
                    <PaginatedStandings
                      key={t.pool}
                      rows={t.rows}
                      title={t.pool ? `Zone ${t.pool}` : undefined}
                      logos={Object.fromEntries(logos)}
                      zones={{ promotion: current.promotionSpots, relegation: current.relegationSpots }}
                    />
                  ))
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
                    <div key={k}>
                      <dd className="font-heading text-2xl font-bold">{v}</dd>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                    </div>
                  ))}
                </dl>
                <h3 className="font-semibold">Meilleurs buteurs</h3>
                <ScorersList scorers={data?.[0]?.scorers ?? []} />
              </aside>
            </section>

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
                      <Link href={`/clubs/${t.slug}`} className="flex h-full flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <ClubLogo src={logos.get(t.clubId)} name={t.name} className="size-16" />
                        <span className="font-heading leading-tight font-bold uppercase">{t.name}</span>
                        <span className="text-xs text-muted-foreground">{[t.city, t.pool && `Zone ${t.pool}`].filter(Boolean).join(" · ")}</span>
                        {t.league && <span className="text-xs text-muted-foreground">{t.league}</span>}
                        {t.outcome && <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{TEAM_OUTCOME_LABELS[t.outcome]}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Informations officielles</h2>
            {ch.description ? <p className="whitespace-pre-line text-sm leading-relaxed">{ch.description}</p> : <Empty>Informations à venir.</Empty>}
            {current && (current.promotionSpots > 0 || current.relegationSpots > 0) && (
              <p className="text-sm">
                Saison {seasonLabel(current.season)} : {current.promotionSpots} montée(s) et {current.relegationSpots} descente(s){pools.length > 1 ? " par zone" : ""}.
              </p>
            )}
            {active.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {active.map((o) => (
                  <li key={o.id}>
                    <strong>{o.fullName}</strong> — {o.position} <span className="text-muted-foreground">(depuis le {formatDate(new Date(o.startDate))})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Documents et règlements</h2>
            {documents.length === 0 ? (
              <Empty>Aucun document publié.</Empty>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border bg-card text-sm">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <a href={`/media/championnats/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                      {d.title}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.season ? seasonLabel(d.season) : "Permanent"} · PDF</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
