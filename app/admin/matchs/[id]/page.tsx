import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ClubLogo } from "@/components/public/club-logo";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { canReschedule, EVENT_TYPE_LABELS, GOAL_EVENTS, hasScore, MATCH_STATUS_LABELS, roundLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { matchEvents, matches, matchLineups, matchOfficials, players, referees, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { entityHistory } from "@/lib/queries/audit";
import { canEditMatchSheet, canManageMatch, eligiblePlayers, matchQuery, refereeOf } from "@/lib/queries/competitions";
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES, REFEREE_GRADE_LABELS } from "@/lib/referees";
import { addMatchEvent, deleteMatchEvent, designateOfficial, removeOfficial, scheduleMatch, setMatchFeatured, updateMatchSheet, validateResult } from "../actions";
import { FeaturedToggle } from "@/components/featured-toggle";
import { DesignationForm, EventForm, ScheduleForm, SheetForm } from "../MatchForms";

export const metadata: Metadata = { title: "Feuille de match — FECOFOOT" };

/** Valeur d'un champ datetime-local en heure de Brazzaville. */
const localInput = (d: Date | null) => (d ? new Date(d.getTime() + 3600_000).toISOString().slice(0, 16) : "");
const playerIn = alias(players, "player_in");

const HISTORY_LABELS: Record<string, string> = {
  SCHEDULE: "Programmation",
  MATCH_SHEET: "Feuille de match",
  RESULT_CORRECTION: "Correction du résultat",
  RESULT_VALIDATED: "Résultat validé",
  MATCH_EVENT: "Événement ajouté",
  MATCH_EVENT_DELETE: "Événement supprimé",
  LINEUP: "Composition",
  DESIGNATE: "Désignation",
  UNDESIGNATE: "Désignation retirée",
  OFFICIAL_REPORT: "Rapport d’officiel",
};

export default async function MatchPage({ params }: PageProps<"/admin/matchs/[id]">) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await matchQuery().where(eq(matches.id, id)).limit(1);
  if (!row) notFound();
  const { match: m, competition: c, home, away } = row;

  const manage = await canManageMatch(user, id);
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
      .select({ event: matchEvents, lastName: players.lastName, firstName: players.firstName, inLastName: playerIn.lastName, inFirstName: playerIn.firstName })
      .from(matchEvents)
      .leftJoin(players, eq(matchEvents.playerId, players.id))
      .leftJoin(playerIn, eq(matchEvents.playerInId, playerIn.id))
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
  const [history, validator] = await Promise.all([
    manage || refereeing ? entityHistory("match", id) : Promise.resolve([]),
    m.validatedBy ? db.select({ name: users.fullName }).from(users).where(eq(users.id, m.validatedBy)).limit(1) : Promise.resolve([]),
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
  const played = hasScore(m.status);
  const pendingValidation = m.status === "FINISHED" && !m.validatedAt;
  const totalRounds = c.type === "CUP" ? (await db.select({ round: matches.round }).from(matches).where(eq(matches.competitionId, c.id))).reduce((a, b) => Math.max(a, b.round), 0) : 0;

  return (
    <>
      <PageHeader
        eyebrow={`${c.name} · ${c.type === "CUP" ? roundLabel(m.round, totalRounds) : `Journée ${m.round}`}`}
        title={`${home?.name ?? "À déterminer"} ${played ? `${m.homeScore} – ${m.awayScore}` : "–"} ${away?.name ?? "À déterminer"}`}
        description={`${m.kickoffAt ? formatDateTime(m.kickoffAt) : "Date à fixer"}${m.venue ? ` · ${m.venue}` : ""} · ${MATCH_STATUS_LABELS[m.status]}${m.attendance ? ` · ${m.attendance} spectateurs` : ""}`}
        actions={
          manage && (
            <>
              <FeaturedToggle action={setMatchFeatured.bind(null, id)} featured={m.featured} />
              <Link href={`/admin/competitions/${c.id}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
                Compétition
              </Link>
            </>
          )
        }
      />

      <div className="flex flex-col gap-10">
        {/* Bandeau : les deux équipes avec leur logo et le score */}
        <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6" aria-label="Rencontre">
          {[home, away].map((team, i) => (
            <div key={i} className={`flex min-w-0 items-center gap-3 ${i === 0 ? "order-1 justify-end text-right" : "order-3"}`}>
              {i === 1 && team && <ClubLogo src={team.logo} name={team.name} className="size-14 text-sm" />}
              <span className="min-w-0 font-display text-base leading-tight font-bold uppercase sm:text-xl">{team?.name ?? "À déterminer"}</span>
              {i === 0 && team && <ClubLogo src={team.logo} name={team.name} className="size-14 text-sm" />}
            </div>
          ))}
          <span className="order-2 rounded-lg bg-brand-ink px-4 py-2 font-heading text-2xl font-bold text-white tabular-nums sm:text-3xl">
            {played ? `${m.homeScore ?? 0} – ${m.awayScore ?? 0}` : "–"}
          </span>
        </section>

        {/* Résultat officiel : validation par l'organisateur */}
        {m.status === "FINISHED" && (
          <section className="flex flex-col gap-3" aria-label="Résultat officiel">
            {pendingValidation ? (
              <>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge tone="wait">Résultat en attente de validation</StatusBadge>
                  Il ne compte pas encore au classement et n&apos;apparaît pas comme définitif sur le portail.
                </p>
                {manage && <ActionForm action={validateResult.bind(null, id)} label="Valider le résultat" variant="default" />}
              </>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge tone="ok">Résultat officiel</StatusBadge>
                Validé le {formatDateTime(m.validatedAt)}
                {validator[0] && ` par ${validator[0].name}`}. Toute correction est inscrite à l&apos;historique.
              </p>
            )}
          </section>
        )}

        {manage && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Programmation</h2>
            {canReschedule(m.status) ? (
              <ScheduleForm action={scheduleMatch.bind(null, id)} kickoff={localInput(m.kickoffAt)} venue={m.venue ?? ""} />
            ) : (
              <p className="text-sm text-muted-foreground">Le match a commencé : la date, l&apos;heure et le stade ne se modifient plus.</p>
            )}
          </section>
        )}

        {/* Événements (EF-CMP-05) */}
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Buts, cartons et remplacements</h2>
          {events.length === 0 ? (
            <EmptyState icon="document" title="Aucun événement saisi" compact>Buts, cartons et remplacements s’ajoutent avec le formulaire de la feuille de match.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {events.map(({ event: e, lastName, firstName, inLastName, inFirstName }) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <strong className="mr-2 tabular-nums">{e.minute}&apos;</strong>
                    {EVENT_TYPE_LABELS[e.type]} — {firstName} {lastName}
                    {e.type === "SUBSTITUTION" && inLastName && ` → ${inFirstName} ${inLastName}`} <span className="text-muted-foreground">({teamName(e.clubId)})</span>
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
            {m.validatedAt && !manage ? (
              <p className="text-sm text-muted-foreground">Résultat validé : seule l&apos;organisation de la compétition peut le corriger.</p>
            ) : (
              <SheetForm
                action={updateMatchSheet.bind(null, id)}
                values={m}
                cup={c.type === "CUP"}
                scoreFromGoals={events.some((e) => GOAL_EVENTS.includes(e.event.type))}
                teams={[home?.name ?? "Domicile", away?.name ?? "Extérieur"]}
              />
            )}
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
        {history.length > 0 && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Historique des modifications</h2>
            <ol className="flex flex-col divide-y rounded-lg border text-sm">
              {history.map((h) => {
                const d = (h.details ?? {}) as { before?: { score?: (number | null)[] }; after?: { score?: (number | null)[]; status?: string } };
                const score = (sc?: (number | null)[]) => (sc && sc[0] !== null && sc[0] !== undefined ? `${sc[0]} – ${sc[1]}` : "—");
                return (
                  <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                    <span>
                      <strong>{HISTORY_LABELS[h.action] ?? h.action}</strong>
                      {d.after?.score && ` · ${score(d.before?.score)} → ${score(d.after.score)}`}
                      <span className="text-muted-foreground"> · {h.user ?? "Système"}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
