import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { MatchStatusBadge } from "@/components/matches/match-card";
import { ClubLogo } from "@/components/public/club-logo";
import { PublicShell } from "@/components/public/public-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { clubLogos } from "@/lib/club-logos";
import { EVENT_TYPE_LABELS, isLive, matchHistory, roundLabel, type EventType } from "@/lib/competitions";
import { db } from "@/lib/db";
import { auditLogs, championships, competitions, leagues, matchEvents, matches, matchLineups, matchOfficials, players, referees } from "@/lib/db/schema";
import { formatDateTime, formatMatchDate, kickoffTime } from "@/lib/format";
import { championshipLogoUrl, leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES } from "@/lib/referees";
import { matchQuery } from "@/lib/queries/competitions";
import { fromClub } from "@/lib/queries/matches";

const playerIn = alias(players, "player_in");

async function load(id: number) {
  if (!Number.isInteger(id)) return null;
  const [row] = await matchQuery().where(eq(matches.id, id)).limit(1);
  // Les matchs d'une compétition en préparation ne sont pas publiés.
  return row && row.competition.status !== "DRAFT" ? row : null;
}

const title = (r: NonNullable<Awaited<ReturnType<typeof load>>>) => `${r.home?.name ?? "À déterminer"} – ${r.away?.name ?? "À déterminer"}`;

export async function generateMetadata({ params }: PageProps<"/matchs/[id]">): Promise<Metadata> {
  const row = await load(Number((await params).id));
  return row ? { title: `${title(row)} — FECOFOOT`, description: `${row.competition.name} : score, date, stade et événements du match.` } : {};
}

/** Étapes publiques du journal (jamais l'auteur ni les détails internes). */
const HISTORY_ACTIONS = ["SCHEDULE", "MATCH_SHEET", "RESULT_VALIDATED", "RESULT_CORRECTION"];

/** Pictogramme d'un événement (décoratif : le type est écrit pour les lecteurs d'écran). */
function EventIcon({ type }: { type: EventType }) {
  if (type === "YELLOW_CARD" || type === "RED_CARD")
    return <span aria-hidden className={`inline-block h-4 w-3 rounded-[2px] ${type === "YELLOW_CARD" ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-red)]"}`} />;
  if (type === "SUBSTITUTION")
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-flag-green" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-4 ${type === "OWN_GOAL" ? "text-[var(--flag-red)]" : ""}`}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.5 10.9 6.6 9.8 10H6.2L5.1 6.6Z" fill="var(--background)" />
    </svg>
  );
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-heading text-lg font-bold uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Fiche publique d'un match : tableau de score (statut, minute, tirs au but), chronologie des événements,
 * statistiques tirées des événements saisis, compositions, officiels, feuille de match et historique.
 */
export default async function PublicMatchPage({ params }: PageProps<"/matchs/[id]">) {
  const row = await load(Number((await params).id));
  if (!row) notFound();
  const { match: m, home, away } = row;
  // Compositions publiées au coup d'envoi (avant, elles restent internes aux clubs et à l'organisateur).
  const started = isLive(m.status) || m.status === "FINISHED" || m.status === "SUSPENDED";
  const [[context], events, logos, total, officials, lineups, log] = await Promise.all([
    db
      .select({
        c: competitions,
        league: { id: leagues.id, name: leagues.name, code: leagues.code, logoKey: leagues.logoKey },
        championship: { id: championships.id, name: championships.name, code: championships.code, logoKey: championships.logoKey },
      })
      .from(competitions)
      .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
      .leftJoin(championships, eq(competitions.championshipId, championships.id))
      .where(eq(competitions.id, m.competitionId))
      .limit(1),
    db
      .select({ e: matchEvents, lastName: players.lastName, firstName: players.firstName, inLastName: playerIn.lastName, inFirstName: playerIn.firstName })
      .from(matchEvents)
      .leftJoin(players, eq(matchEvents.playerId, players.id))
      .leftJoin(playerIn, eq(matchEvents.playerInId, playerIn.id))
      .where(eq(matchEvents.matchId, m.id))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.id)),
    clubLogos([m.homeClubId, m.awayClubId].filter((x): x is number => x !== null)),
    row.competition.type === "CUP" ? db.select({ round: matches.round }).from(matches).where(eq(matches.competitionId, m.competitionId)) : Promise.resolve([]),
    db
      .select({ role: matchOfficials.role, lastName: referees.lastName, firstName: referees.firstName })
      .from(matchOfficials)
      .innerJoin(referees, eq(matchOfficials.refereeId, referees.id))
      .where(eq(matchOfficials.matchId, m.id)),
    started
      ? db
          .select({ l: matchLineups, lastName: players.lastName, firstName: players.firstName })
          .from(matchLineups)
          .innerJoin(players, eq(matchLineups.playerId, players.id))
          .where(eq(matchLineups.matchId, m.id))
          .orderBy(asc(matchLineups.shirtNumber), asc(players.lastName))
      : Promise.resolve([]),
    db
      .select({ action: auditLogs.action, details: auditLogs.details, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(and(eq(auditLogs.entity, "match"), eq(auditLogs.entityId, String(m.id)), inArray(auditLogs.action, HISTORY_ACTIONS))),
  ]);
  officials.sort((a, b) => OFFICIAL_ROLES.indexOf(a.role) - OFFICIAL_ROLES.indexOf(b.role));
  const c = context.c;
  const cupRounds = new Map([[c.id, total.reduce((a, b) => Math.max(a, b.round), m.round)]]);
  const item = fromClub(row, cupRounds);
  const live = isLive(m.status);
  const showScore = item.score && !item.awaiting && (live || m.status === "FINISHED" || m.status === "SUSPENDED");
  const competitionHref = context.championship?.code ? `/championnats/${context.championship.code}?saison=${c.season}` : `/competitions/${c.slug}`;
  const competitionLogo = context.championship?.id ? championshipLogoUrl(context.championship) : context.league?.id ? leagueLogoUrl(context.league) : null;
  const round = c.type === "CUP" ? roundLabel(m.round, cupRounds.get(c.id)!) : `Journée ${m.round}`;
  const side = (clubId: number) => (clubId === m.homeClubId ? "home" : "away");
  const history = matchHistory(log);
  // Avant le coup d'envoi : l'heure à la place du score.
  const upcomingTime = item.status === "UPCOMING" && !item.stale && m.kickoffAt ? kickoffTime(m.kickoffAt) : null;

  // Statistiques tirées des seuls événements saisis par les officiels (aucune donnée estimée).
  const stat = (types: EventType[], clubId: number | null) => events.filter((x) => types.includes(x.e.type) && x.e.clubId === clubId).length;
  const stats = (
    [
      ["Buts", ["GOAL", "PENALTY_GOAL", "OWN_GOAL"]],
      ["Dont penalties", ["PENALTY_GOAL"]],
      ["Avertissements", ["YELLOW_CARD"]],
      ["Expulsions", ["RED_CARD"]],
      ["Remplacements", ["SUBSTITUTION"]],
    ] as const
  ).map(([label, types]) => ({ label, home: stat([...types], m.homeClubId), away: stat([...types], m.awayClubId) }));

  const facts: [string, string][] = [
    ["Date et heure", m.kickoffAt ? formatMatchDate(m.kickoffAt) : "À fixer"],
    ["Stade", m.venue ?? "À préciser"],
    ["Compétition", `${c.name} · ${round}${m.pool ? ` · Poule ${m.pool}` : ""}`],
    ["Organisateur", context.championship?.name ? `Fédération · ${context.championship.name}` : (context.league?.name ?? "Fédération Congolaise de Football")],
  ];
  if (m.attendance) facts.push(["Affluence", `${m.attendance.toLocaleString("fr-FR")} spectateurs`]);

  return (
    <PublicShell eyebrow="Matchs" title={title(row)} subtitle={`${c.name} · ${seasonLabel(c.season)} · ${round}`} wide>
      <div className="flex flex-col gap-10">
        {live && <LiveRefresh seconds={20} />}

        {/* Tableau de score */}
        <section aria-label="Score" className="brand-band relative isolate overflow-hidden rounded-3xl px-4 py-6 shadow-lg sm:px-10 sm:py-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel décoratif */}
          <img src="/fecofoot-mark.svg" alt="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 -z-10 h-[140%] w-auto opacity-[0.06] select-none" />
          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs font-semibold tracking-[0.14em] text-white/70 uppercase sm:mb-8">
            {competitionLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
              <img src={competitionLogo} alt="" className="size-7 rounded-md bg-white object-contain p-0.5" />
            )}
            <Link href={competitionHref} className="text-[var(--flag-yellow)] hover:underline">
              {c.name}
            </Link>
            <span>{round}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
            {[home, null, away].map((team, i) =>
              i === 1 ? (
                <div key="score" className="flex flex-col items-center gap-2.5 text-center">
                  <MatchStatusBadge item={item} size="lg" />
                  <span className="font-display text-5xl leading-none font-bold text-white tabular-nums sm:text-7xl">
                    {showScore ? `${item.score![0]} - ${item.score![1]}` : (upcomingTime ?? "–")}
                  </span>
                  {showScore && item.penalties && (
                    <span className="text-xs font-semibold text-white/80">
                      Tirs au but : {item.penalties[0]} - {item.penalties[1]}
                    </span>
                  )}
                  {item.awaiting && <span className="text-xs text-white/70">Résultat en attente de validation</span>}
                </div>
              ) : (
                <div key={i} className="flex min-w-0 flex-col items-center gap-3 text-center">
                  {team ? (
                    <>
                      <span className="grid size-20 place-items-center rounded-2xl bg-white p-2 shadow-md sm:size-28">
                        <ClubLogo src={logos.get(team.id)} name={team.name} className="size-full text-lg" />
                      </span>
                      <span className="font-display text-base leading-tight font-bold text-white uppercase sm:text-2xl">{team.name}</span>
                    </>
                  ) : (
                    <span className="text-white/70">À déterminer</span>
                  )}
                </div>
              ),
            )}
          </div>
          {/* Buteurs sous le score, comme sur un tableau d'affichage */}
          {events.some((x) => ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(x.e.type)) && (
            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-white/15 pt-5 text-sm text-white/85">
              {(["home", "away"] as const).map((s) => (
                <ul key={s} className={`flex flex-col gap-1 ${s === "home" ? "items-end text-right" : ""}`}>
                  {events
                    .filter((x) => ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(x.e.type) && side(x.e.clubId) === s)
                    .map(({ e, lastName }) => (
                      <li key={e.id}>
                        {lastName ?? "But"} {e.minute}&apos;{e.type === "PENALTY_GOAL" ? " (pen.)" : e.type === "OWN_GOAL" ? " (c.s.c.)" : ""}
                      </li>
                    ))}
                </ul>
              ))}
            </div>
          )}
        </section>

        <dl className="grid gap-4 rounded-2xl border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-10">
            <Section title="Événements du match" id="evenements">
              {events.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  {started ? "Aucun événement saisi pour ce match." : "Les buts, cartons et remplacements apparaîtront ici dès le coup d'envoi."}
                </p>
              ) : (
                <ol className="flex flex-col divide-y rounded-2xl border bg-card text-sm">
                  {events.map(({ e, lastName, firstName, inLastName, inFirstName }) => {
                    const who = (
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">
                          {firstName} {lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {EVENT_TYPE_LABELS[e.type]}
                          {e.type === "SUBSTITUTION" && inLastName && ` · entre ${inFirstName} ${inLastName}`}
                        </span>
                      </span>
                    );
                    const home = side(e.clubId) === "home";
                    return (
                      <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:px-4">
                        <span className="flex items-center justify-end gap-2 text-right">{home && <>{who}<EventIcon type={e.type} /></>}</span>
                        <span className="justify-self-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">{e.minute}&apos;</span>
                        <span className="flex items-center gap-2">{!home && <><EventIcon type={e.type} />{who}</>}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>

            {lineups.length > 0 && (
              <Section title="Compositions" id="compositions">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[home, away].map((team) =>
                    team ? (
                      <div key={team.id} className="overflow-hidden rounded-2xl border bg-card text-sm">
                        <p className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 font-semibold">
                          <ClubLogo src={logos.get(team.id)} name={team.name} className="size-6 text-[0.55rem]" />
                          {team.name}
                        </p>
                        {[true, false].map((starter) => {
                          const list = lineups.filter((x) => x.l.clubId === team.id && x.l.starter === starter);
                          return list.length > 0 ? (
                            <div key={String(starter)} className="px-4 py-3">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{starter ? "Titulaires" : "Remplaçants"}</p>
                              <ul>
                                {list.map(({ l, lastName, firstName }) => (
                                  <li key={l.id} className="flex gap-3 py-1">
                                    <span className="w-6 shrink-0 text-right font-bold tabular-nums">{l.shirtNumber ?? ""}</span>
                                    {firstName} {lastName}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null;
                        })}
                      </div>
                    ) : null,
                  )}
                </div>
              </Section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-10">
            {started && (
              <Section title="Statistiques" id="statistiques">
                <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
                  <p className="grid grid-cols-[2rem_1fr_2rem] items-center text-xs font-semibold text-muted-foreground">
                    {home ? <ClubLogo src={logos.get(home.id)} name={home.name} className="size-7 text-[0.55rem]" /> : <span />}
                    <span className="text-center">Saisies des officiels</span>
                    {away ? <ClubLogo src={logos.get(away.id)} name={away.name} className="size-7 justify-self-end text-[0.55rem]" /> : <span />}
                  </p>
                  {stats.map((s) => {
                    const sum = s.home + s.away || 1;
                    return (
                      <div key={s.label} className="flex flex-col gap-1.5 text-sm">
                        <p className="grid grid-cols-[2rem_1fr_2rem] items-center">
                          <span className="font-bold tabular-nums">{s.home}</span>
                          <span className="text-center text-muted-foreground">{s.label}</span>
                          <span className="text-right font-bold tabular-nums">{s.away}</span>
                        </p>
                        <span aria-hidden className="flex h-1.5 gap-1">
                          <span className="flex flex-1 justify-end overflow-hidden rounded-full bg-muted">
                            <span className="rounded-full bg-brand-ink" style={{ width: `${(s.home / sum) * 100}%` }} />
                          </span>
                          <span className="flex flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="rounded-full bg-[var(--flag-green)]" style={{ width: `${(s.away / sum) * 100}%` }} />
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section title="Arbitres et officiels" id="officiels">
              {officials.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Désignations à venir.</p>
              ) : (
                <dl className="flex flex-col divide-y rounded-2xl border bg-card text-sm">
                  {officials.map((o) => (
                    <div key={o.role} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <dt className="text-muted-foreground">{OFFICIAL_ROLE_LABELS[o.role]}</dt>
                      <dd className="text-right font-semibold">
                        {o.firstName} {o.lastName}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Section>

            <Section title="Feuille de match" id="feuille">
              <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className={`size-2 rounded-full ${m.validatedAt ? "bg-[var(--flag-green)]" : "bg-muted-foreground"}`} />
                  {m.validatedAt
                    ? `Résultat officiel, validé le ${formatDateTime(m.validatedAt)}`
                    : item.awaiting
                      ? "Résultat saisi, en attente de validation par l'organisateur"
                      : live
                        ? "Score saisi en direct par l'officiel du match"
                        : "Feuille de match ouverte au coup d'envoi"}
                </p>
                {m.scoreSource === "EXTERNAL" && !m.validatedAt && <p className="text-muted-foreground">Score fourni par une source externe, non officiel.</p>}
                <p className="text-muted-foreground">Seuls les résultats validés comptent au classement, selon le règlement de la compétition.</p>
              </div>
            </Section>

            {history.length > 0 && (
              <Section title="Historique" id="historique">
                <ol className="flex flex-col gap-3 border-l-2 border-muted pl-4 text-sm">
                  {history.map((h, i) => (
                    <li key={i} className="relative">
                      <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full border-2 border-background bg-[var(--flag-green)]" />
                      <p className="font-semibold">
                        {h.label}
                        {h.kickoffAt && <span className="font-normal text-muted-foreground"> : {formatMatchDate(h.kickoffAt)}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(h.at)}</p>
                    </li>
                  ))}
                </ol>
              </Section>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={competitionHref} className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted">
            ← {c.name}
          </Link>
          <Link href="/matchs" className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted">
            Tous les matchs
          </Link>
          {context.league?.code && (
            <Link href={`/ligues/${context.league.code.toLowerCase()}`} className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted">
              {context.league.name}
            </Link>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
