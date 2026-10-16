import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { EVENT_TYPE_LABELS, MATCH_STATUS_LABELS, roundLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { matchEvents, matches, matchLineups, matchOfficials, players, referees } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { canEditMatchSheet, eligiblePlayers, matchQuery, refereeOf } from "@/lib/queries/competitions";
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES, REFEREE_GRADE_LABELS } from "@/lib/referees";
import { addMatchEvent, deleteMatchEvent, designateOfficial, removeOfficial, scheduleMatch, updateMatchSheet } from "../actions";
import { DesignationForm, EventForm, ScheduleForm, SheetForm } from "../MatchForms";

export const metadata: Metadata = { title: "Feuille de match — FECOFOOT" };

/** Valeur d'un champ datetime-local en heure de Brazzaville. */
const localInput = (d: Date | null) => (d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 16) : "");

export default async function MatchPage({ params }: PageProps<"/admin/matchs/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await matchQuery().where(eq(matches.id, id)).limit(1);
  if (!row) notFound();
  const { match: m, competition: c, home, away } = row;

  const manage = can(user.role, "competitions.manage");
  const refereeing = can(user.role, "refereeing.manage");
  const sheet = await canEditMatchSheet(user, id);
  const ownClub = can(user.role, "lineups.submit") && (user.clubId === m.homeClubId || user.clubId === m.awayClubId) ? user.clubId : null;
  const me = await refereeOf(user);
  const officials = await db
    .select({ official: matchOfficials, referee: referees })
    .from(matchOfficials)
    .innerJoin(referees, eq(matchOfficials.refereeId, referees.id))
    .where(eq(matchOfficials.matchId, id));
  const designated = me && officials.some((o) => o.referee.id === me.id);
  if (!manage && !refereeing && !sheet && !ownClub && !designated) redirect("/admin/acces-refuse");

  const clubIds = [m.homeClubId, m.awayClubId].filter((x): x is number => x !== null);
  const [events, lineups, activeReferees] = await Promise.all([
    db
      .select({ event: matchEvents, lastName: players.lastName, firstName: players.firstName })
      .from(matchEvents)
      .leftJoin(players, eq(matchEvents.playerId, players.id))
      .where(eq(matchEvents.matchId, id))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.id)),
    db
      .select({ lineup: matchLineups, lastName: players.lastName, firstName: players.firstName })
      .from(matchLineups)
      .innerJoin(players, eq(matchLineups.playerId, players.id))
      .where(eq(matchLineups.matchId, id))
      .orderBy(asc(matchLineups.shirtNumber)),
    refereeing ? db.select().from(referees).where(eq(referees.active, true)).orderBy(asc(referees.lastName)) : Promise.resolve([]),
  ]);

  // Joueurs proposés pour les événements, club par club : sa composition si elle est déposée, sinon ses licenciés.
  const teamName = (clubId: number) => (clubId === home?.id ? (home?.name ?? "") : (away?.name ?? ""));
  const eventPlayers: { id: number; label: string; team: string }[] = [];
  if (sheet && clubIds.length === 2) {
    for (const clubId of clubIds) {
      const lineup = lineups.filter((l) => l.lineup.clubId === clubId);
      if (lineup.length > 0) {
        eventPlayers.push(...lineup.map((l) => ({ id: l.lineup.playerId, label: `${l.lineup.shirtNumber ?? ""} ${l.lastName} ${l.firstName}`.trim(), team: teamName(clubId) })));
      } else {
        const list = await eligiblePlayers(clubId, c.season);
        eventPlayers.push(...list.map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}`, team: teamName(clubId) })));
      }
    }
  }
  const played = m.status === "FINISHED" || m.status === "LIVE";
  const totalRounds = c.type === "CUP" ? (await db.select({ round: matches.round }).from(matches).where(eq(matches.competitionId, c.id))).reduce((a, b) => Math.max(a, b.round), 0) : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${c.name} · ${c.type === "CUP" ? roundLabel(m.round, totalRounds) : `Journée ${m.round}`}`}
        title={`${home?.name ?? "À déterminer"} ${played ? `${m.homeScore} – ${m.awayScore}` : "–"} ${away?.name ?? "À déterminer"}`}
        description={`${m.kickoffAt ? formatDateTime(m.kickoffAt) : "Date à fixer"}${m.venue ? ` · ${m.venue}` : ""} · ${MATCH_STATUS_LABELS[m.status]}${m.attendance ? ` · ${m.attendance} spectateurs` : ""}`}
        actions={
          manage && (
            <Link href={`/admin/competitions/${c.id}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Compétition
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-10">
        {manage && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Programmation</h2>
            <ScheduleForm action={scheduleMatch.bind(null, id)} kickoff={localInput(m.kickoffAt)} venue={m.venue ?? ""} />
          </section>
        )}

        {/* Événements (EF-CMP-05) */}
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Buts et cartons</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement saisi.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {events.map(({ event: e, lastName, firstName }) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <strong className="mr-2 tabular-nums">{e.minute}&apos;</strong>
                    {EVENT_TYPE_LABELS[e.type]} — {firstName} {lastName} <span className="text-muted-foreground">({teamName(e.clubId)})</span>
                  </span>
                  {sheet && (
                    <form action={deleteMatchEvent.bind(null, id, e.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Supprimer
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sheet && clubIds.length === 2 && <EventForm action={addMatchEvent.bind(null, id)} players={eventPlayers} />}
        </section>

        {/* Feuille de match (EF-CMP-04, EF-CMP-09) */}
        {sheet && clubIds.length === 2 && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Feuille de match</h2>
            <SheetForm action={updateMatchSheet.bind(null, id)} values={m} cup={c.type === "CUP"} />
          </section>
        )}
        {!sheet && m.report && (
          <section className="flex flex-col gap-2 border-t pt-6">
            <h2 className="font-semibold">Rapport</h2>
            <p className="whitespace-pre-line text-sm">{m.report}</p>
          </section>
        )}

        {/* Compositions (EF-CMP-07) */}
        {clubIds.length === 2 && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Compositions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[home!, away!].map((team) => {
                const list = lineups.filter((l) => l.lineup.clubId === team.id);
                const canEdit = manage || ownClub === team.id;
                return (
                  <div key={team.id} className="rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-semibold">{team.name}</p>
                    {list.length === 0 ? (
                      <p className="text-muted-foreground">Composition non déposée.</p>
                    ) : (
                      <ul>
                        {list.map((l) => (
                          <li key={l.lineup.id} className={l.lineup.starter ? "" : "text-muted-foreground"}>
                            <span className="inline-block w-6 tabular-nums">{l.lineup.shirtNumber}</span> {l.lastName} {l.firstName}
                            {!l.lineup.starter && " (remplaçant)"}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canEdit && (
                      <Link href={`/admin/matchs/${id}/composition/${team.id}`} className="mt-2 inline-block underline">
                        {list.length ? "Modifier la composition" : "Saisir la composition"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Désignations (EF-ARB-02, EF-ARB-03) */}
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Officiels</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {OFFICIAL_ROLES.map((role) => {
              const o = officials.find((x) => x.official.role === role);
              return (
                <li key={role} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <span className="inline-block w-32 text-muted-foreground">{OFFICIAL_ROLE_LABELS[role]}</span>
                    {o ? (
                      <strong>
                        {o.referee.firstName} {o.referee.lastName}
                      </strong>
                    ) : (
                      "—"
                    )}
                    {o && <span className="ml-2 text-xs text-muted-foreground">{REFEREE_GRADE_LABELS[o.referee.grade]}</span>}
                  </span>
                  {o && refereeing && (
                    <form action={removeOfficial.bind(null, id, o.official.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Retirer
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {refereeing && (
            <DesignationForm
              action={designateOfficial.bind(null, id)}
              referees={activeReferees.map((r) => ({ id: r.id, label: `${r.lastName} ${r.firstName} — ${REFEREE_GRADE_LABELS[r.grade]}` }))}
            />
          )}
          {refereeing && officials.some((o) => o.official.report) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Rapports des officiels</h3>
              {officials
                .filter((o) => o.official.report)
                .map((o) => (
                  <p key={o.official.id} className="whitespace-pre-line rounded-lg border p-3 text-sm">
                    <strong>
                      {OFFICIAL_ROLE_LABELS[o.official.role]} — {o.referee.firstName} {o.referee.lastName}
                    </strong>{" "}
                    <span className="text-xs text-muted-foreground">{formatDateTime(o.official.reportAt)}</span>
                    <br />
                    {o.official.report}
                  </p>
                ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
