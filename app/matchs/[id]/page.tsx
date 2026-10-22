import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ClubLogo } from "@/components/public/club-logo";
import { PublicShell } from "@/components/public/public-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { clubLogos } from "@/lib/club-logos";
import { EVENT_TYPE_LABELS, hasScore, isLive, MATCH_STATUS_LABELS, roundLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { championships, competitions, leagues, matchEvents, matches, matchLineups, matchOfficials, players, referees } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES } from "@/lib/referees";
import { matchQuery } from "@/lib/queries/competitions";

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

/** Fiche publique d'un match : équipes, score officiel, date, stade, statut, compétition, événements, compositions, officiels. */
export default async function PublicMatchPage({ params }: PageProps<"/matchs/[id]">) {
  const row = await load(Number((await params).id));
  if (!row) notFound();
  const { match: m, home, away } = row;
  // Compositions publiées au coup d'envoi (avant, elles restent internes aux clubs et à l'organisateur).
  const started = isLive(m.status) || m.status === "FINISHED";
  const [[context], events, logos, total, officials, lineups] = await Promise.all([
    db
      .select({ c: competitions, league: { name: leagues.name, code: leagues.code }, championship: { name: championships.name, code: championships.code } })
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
  ]);
  officials.sort((a, b) => OFFICIAL_ROLES.indexOf(a.role) - OFFICIAL_ROLES.indexOf(b.role));
  const c = context.c;
  // Score affiché : en direct sur saisie officielle, définitif une fois validé par l'organisateur.
  const awaiting = m.status === "FINISHED" && !m.validatedAt;
  const showScore = hasScore(m.status) && !awaiting;
  const live = isLive(m.status);
  const competitionHref = context.championship?.code ? `/championnats/${context.championship.code}?saison=${c.season}` : `/competitions/${c.slug}`;
  const round = c.type === "CUP" ? roundLabel(m.round, total.reduce((a, b) => Math.max(a, b.round), 0)) : `Journée ${m.round}`;
  const side = (clubId: number) => (clubId === m.homeClubId ? "home" : "away");

  return (
    <PublicShell eyebrow="Matchs" title={title(row)} subtitle={`${c.name} · ${seasonLabel(c.season)} · ${round}`} wide>
      <div className="flex flex-col gap-8">
        <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border bg-card p-6 shadow-sm sm:gap-6 sm:p-8" aria-label="Score">
          {[home, null, away].map((team, i) =>
            i === 1 ? (
              <div key="score" className="flex flex-col items-center gap-2 text-center">
                {live && <span className="rounded bg-[var(--flag-red,#dc241f)] px-2 py-0.5 text-xs font-bold text-white uppercase">● {MATCH_STATUS_LABELS[m.status]}</span>}
                <span className="rounded-lg bg-brand-ink px-4 py-2 font-heading text-4xl font-bold text-white tabular-nums sm:text-5xl">
                  {showScore ? `${m.homeScore ?? 0} – ${m.awayScore ?? 0}` : "–"}
                </span>
                {showScore && m.homePenalties !== null && m.awayPenalties !== null && (
                  <span className="text-xs text-muted-foreground">
                    Tirs au but : {m.homePenalties} – {m.awayPenalties}
                  </span>
                )}
                <span className="text-xs font-semibold text-muted-foreground">
                  {awaiting ? "Résultat en attente de validation" : m.status === "FINISHED" ? "Résultat officiel" : MATCH_STATUS_LABELS[m.status]}
                </span>
                {showScore && m.scoreSource === "EXTERNAL" && !m.validatedAt && (
                  <span className="text-[0.7rem] text-muted-foreground">Score fourni par une source externe, non officiel</span>
                )}
              </div>
            ) : (
              <div key={i} className="flex min-w-0 flex-col items-center gap-2 text-center">
                {team ? (
                  <>
                    <ClubLogo src={logos.get(team.id)} name={team.name} className="size-16 sm:size-24" />
                    <span className="font-heading text-base leading-tight font-bold uppercase sm:text-xl">{team.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">À déterminer</span>
                )}
              </div>
            ),
          )}
        </section>

        {live && <LiveRefresh seconds={20} />}

        <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-4">
          {(
            [
              ["Date et heure", m.kickoffAt ? formatDateTime(m.kickoffAt) : "À fixer"],
              ["Stade", m.venue ?? "À préciser"],
              ["Compétition", c.name],
              ["Organisateur", context.championship?.name ? `Championnat national ${context.championship.name}` : (context.league?.name ?? "Fédération")],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Événements du match</h2>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucun événement publié pour ce match.</p>
          ) : (
            <ol className="flex flex-col divide-y rounded-lg border bg-card text-sm">
              {events.map(({ e, lastName, firstName, inLastName, inFirstName }) => (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-2 ${side(e.clubId) === "away" ? "flex-row-reverse text-right" : ""}`}>
                  <strong className="w-10 shrink-0 tabular-nums">{e.minute}&apos;</strong>
                  <span>
                    <span className="font-semibold">{EVENT_TYPE_LABELS[e.type]}</span> — {firstName} {lastName}
                    {e.type === "SUBSTITUTION" && inLastName && ` → ${inFirstName} ${inLastName}`}
                    <span className="text-muted-foreground"> ({side(e.clubId) === "home" ? home?.name : away?.name})</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {lineups.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Compositions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[home, away].map((team) =>
                team ? (
                  <div key={team.id} className="rounded-lg border bg-card p-4 text-sm">
                    <p className="mb-2 flex items-center gap-2 font-semibold">
                      <ClubLogo src={logos.get(team.id)} name={team.name} className="size-6 text-[0.55rem]" />
                      {team.name}
                    </p>
                    {[true, false].map((starter) => {
                      const list = lineups.filter((x) => x.l.clubId === team.id && x.l.starter === starter);
                      return list.length > 0 ? (
                        <div key={String(starter)} className="mt-2">
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{starter ? "Titulaires" : "Remplaçants"}</p>
                          <ul>
                            {list.map(({ l, lastName, firstName }) => (
                              <li key={l.id} className="flex gap-2 py-0.5">
                                <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{l.shirtNumber ?? ""}</span>
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
          </section>
        )}

        {officials.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Officiels du match</h2>
            <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 text-sm sm:grid-cols-5">
              {officials.map((o) => (
                <div key={o.role} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{OFFICIAL_ROLE_LABELS[o.role]}</dt>
                  <dd className="font-medium">
                    {o.firstName} {o.lastName}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={competitionHref} className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted">
            ← {c.name}
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
