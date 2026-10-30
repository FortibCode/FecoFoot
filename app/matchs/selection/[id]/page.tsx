import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FixtureGroups } from "@/components/matches/fixture-groups";
import { FormRows } from "@/components/matches/form-rows";
import { MatchStatusBadge } from "@/components/matches/match-card";
import { MatchTabs } from "@/components/matches/match-tabs";
import { Pitch } from "@/components/matches/pitch";
import {
  EventTimeline,
  StatsPanel,
  type TimelineEvent,
} from "@/components/matches/stats-panel";
import { MatchHeader } from "@/components/matches/match-header";
import { ShareBar } from "@/components/matches/share-bar";
import { PublicShell } from "@/components/public/public-shell";
import { Countdown } from "@/components/matches/countdown";
import { GroupMatchdays, GroupTable } from "@/components/matches/group-table";
import { formatMatchDate, kickoffTime } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { fromNational, openTicketSales } from "@/lib/queries/matches";
import {
  fixtureScore,
  fixtureSheet,
  groupDetail,
  nationalCalendar,
  nationalFixture,
  nationalHeadToHead,
  nationalRecord,
  selectionForFixture,
} from "@/lib/queries/national";

const title = (row: NonNullable<Awaited<ReturnType<typeof nationalFixture>>>) =>
  `${row.sides[0].name} – ${row.sides[1].name}`;

export async function generateMetadata({
  params,
}: PageProps<"/matchs/selection/[id]">): Promise<Metadata> {
  const row = await nationalFixture(Number((await params).id));
  return row
    ? {
        title: `${title(row)} · ${row.team.name} — FECOFOOT`,
        description: `${row.team.name} : ${title(row)}, ${row.f.competition ?? "match international"}.`,
      }
    : {};
}

const Muted = ({ children }: { children: string }) => (
  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
    {children}
  </p>
);

/**
 * Fiche d'un match des sélections nationales, joué ou à venir : tableau de score, billetterie, partage et
 * agenda, avant-match (bilan, forme, séries), convoqués publiés, face-à-face et calendrier de la sélection.
 */
export default async function NationalMatchPage({
  params,
}: PageProps<"/matchs/selection/[id]">) {
  const row = await nationalFixture(Number((await params).id));
  if (!row) notFound();
  const { f, team, sides } = row;
  const item = fromNational({ f, team: team.name, teamSlug: team.slug });
  const upcoming = item.status === "UPCOMING" && !item.stale;
  const score = fixtureScore(f);
  const [record, h2h, calendar, called, [ticket], group] = await Promise.all([
    nationalRecord(team.id, f.kickoffAt, f.id),
    nationalHeadToHead(team.id, f.opponent, f.id),
    nationalCalendar(team.id),
    selectionForFixture(team.id, f.kickoffAt),
    upcoming ? openTicketSales({ fixtureIds: [f.id] }) : Promise.resolve([]),
    f.groupId ? groupDetail(f.groupId) : Promise.resolve(null),
  ]);
  const sheet = await fixtureSheet(f.id, f.lineupPublished);
  // Côté du Congo dans l'affichage domicile / extérieur.
  const homeSide = (side: "CONGO" | "OPPONENT") =>
    (side === "CONGO") === f.isHome;
  const timeline: TimelineEvent[] = sheet.events.map((e) => ({
    id: e.id,
    minute: e.minute,
    type: e.type,
    home: homeSide(e.side),
    player: e.player,
    second: e.secondPlayer,
  }));
  const goals = timeline.filter(
    (e) =>
      e.type === "GOAL" || e.type === "PENALTY_GOAL" || e.type === "OWN_GOAL",
  );
  const hasStats = Object.keys(sheet.stats).length > 0;
  // « Éliminatoires de la CAN · Groupe G · Journée 3 » quand le match est rattaché à son groupe.
  const stage = group
    ? [
        group.competition.name,
        group.group.name,
        f.matchday ? `Journée ${f.matchday}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : f.competition;
  const time = kickoffTime(f.kickoffAt);
  const t = record.totals;

  return (
    <PublicShell
      eyebrow="Matchs"
      title={title(row)}
      subtitle={[team.name, stage].filter(Boolean).join(" · ")}
      wide
      hero={<div className="h-2" />}
    >
      <div className="flex flex-col gap-8">
        {/* En-tête du match : compact, équipes de part et d'autre du score */}
        <MatchHeader
          actions={
            <ShareBar
              title={`${title(row)} — ${team.name}`}
              path={`/matchs/selection/${f.id}`}
              agenda={upcoming ? `/matchs/selection/${f.id}/agenda` : null}
            />
          }
          title={title(row)}
          stage={[team.name, stage].filter(Boolean).join(" · ")}
          stageHref={`/equipes-nationales/${team.slug}`}
          home={{
            name: sides[0].name,
            flag:
              sides[0].flag ??
              (sides[0].name === "Congo" ? "/flags/cg.svg" : null),
          }}
          away={{
            name: sides[1].name,
            flag:
              sides[1].flag ??
              (sides[1].name === "Congo" ? "/flags/cg.svg" : null),
          }}
          main={
            score && f.status === "PLAYED"
              ? `${score[0]} - ${score[1]}`
              : upcoming && time
                ? time
                : "–"
          }
          date={f.kickoffAt}
          status={
            upcoming ? (
              <Countdown at={f.kickoffAt.toISOString()} />
            ) : (
              <MatchStatusBadge item={item} />
            )
          }
          details={
            <>
              {item.stale && (
                <span className="text-xs text-muted-foreground">
                  Résultat pas encore publié par la fédération
                </span>
              )}
              {f.venue && (
                <span className="text-xs text-muted-foreground">{f.venue}</span>
              )}
            </>
          }
          below={
            goals.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-6 border-t pt-3 text-xs text-muted-foreground sm:text-sm">
                {[true, false].map((home) => (
                  <ul
                    key={String(home)}
                    className={`flex flex-col gap-0.5 ${home ? "items-end text-right" : ""}`}
                  >
                    {/* Un but contre son camp profite à l'autre équipe. */}
                    {goals
                      .filter(
                        (g) =>
                          (g.type === "OWN_GOAL" ? !g.home : g.home) === home,
                      )
                      .map((g) => (
                        <li key={g.id}>
                          {g.player} {g.minute}&apos;
                          {g.type === "PENALTY_GOAL"
                            ? " (pen.)"
                            : g.type === "OWN_GOAL"
                              ? " (c.s.c.)"
                              : ""}
                        </li>
                      ))}
                  </ul>
                ))}
              </div>
            ) : undefined
          }
        />

        {ticket && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border-[var(--flag-yellow)] bg-[color-mix(in_srgb,var(--flag-yellow)_14%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <p className="text-sm">
              <strong className="font-semibold">Billetterie ouverte</strong>
              {ticket.salesStatus === "PRESALE"
                ? " : prévente réservée aux membres Fan ID."
                : " : places en vente, paiement Mobile Money."}
            </p>
            <Link
              href={`/billetterie/${ticket.slug}`}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--flag-yellow)] px-5 text-sm font-semibold text-brand-ink hover:brightness-95"
            >
              Acheter un billet <span aria-hidden>→</span>
            </Link>
          </div>
        )}

        <MatchTabs
          label="Rubriques du match"
          initial={
            !upcoming && (timeline.length > 0 || hasStats)
              ? "evenements"
              : "avant-match"
          }
          tabs={[
            {
              id: "avant-match",
              label: "Avant-match",
              panel: (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <section
                    aria-labelledby="bilan"
                    className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4"
                  >
                    <div>
                      <h3
                        id="bilan"
                        className="font-heading text-base font-bold uppercase"
                      >
                        Statistiques générales · {team.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t.played > 1
                          ? `${t.played} derniers matchs joués avant cette rencontre`
                          : t.played === 1
                            ? "Dernier match joué avant cette rencontre"
                            : "Aucun match joué enregistré"}
                      </p>
                    </div>
                    {t.played > 0 && (
                      <dl className="grid grid-cols-3 gap-2 text-center">
                        {(
                          [
                            ["Victoires", t.wins, "text-[var(--flag-green)]"],
                            ["Nuls", t.draws, ""],
                            ["Défaites", t.losses, "text-[var(--flag-red)]"],
                            ["Buts marqués", t.goalsFor, ""],
                            ["Buts encaissés", t.goalsAgainst, ""],
                            [
                              "Matchs d'affilée avec un but",
                              record.totals.scoringRun,
                              "",
                            ],
                          ] as const
                        ).map(([k, v, tone]) => (
                          <div
                            key={k}
                            className="flex flex-col-reverse gap-0.5 rounded-xl bg-card p-3"
                          >
                            <dt className="text-xs text-muted-foreground">
                              {k}
                            </dt>
                            <dd
                              className={`font-display text-2xl font-bold tabular-nums ${tone}`}
                            >
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {record.recent.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Série en cours : {record.streaks.wins} victoire
                        {record.streaks.wins > 1 ? "s" : ""} d&apos;affilée,{" "}
                        {record.streaks.unbeaten} match
                        {record.streaks.unbeaten > 1 ? "s" : ""} sans défaite.
                      </p>
                    )}
                  </section>
                  <section
                    aria-labelledby="forme"
                    className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4"
                  >
                    <h3
                      id="forme"
                      className="font-heading text-base font-bold uppercase"
                    >
                      Forme récente
                    </h3>
                    <FormRows
                      items={record.recent}
                      empty="Aucun match joué enregistré avant cette rencontre."
                    />
                  </section>
                </div>
              ),
            },
            {
              id: "compositions",
              label: "Compositions",
              panel:
                sheet.lineup.length > 0 ? (
                  <Pitch
                    home={{
                      id: 0,
                      name: "Congo",
                      flag: "/flags/cg.svg",
                      formation: f.formation,
                      players: sheet.lineup,
                    }}
                    away={null}
                  />
                ) : (
                  <Muted>
                    {upcoming
                      ? "La composition officielle du Congo (système de jeu, onze de départ et remplaçants) sera publiée ici par le staff technique avant le coup d'envoi."
                      : "La composition du Congo n'a pas été publiée pour ce match."}
                  </Muted>
                ),
            },
            {
              id: "evenements",
              label: "Événements",
              panel: (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                  <section
                    aria-label="Chronologie"
                    className="flex flex-col gap-3"
                  >
                    <h3 className="font-heading text-base font-bold uppercase">
                      Chronologie
                    </h3>
                    {timeline.length > 0 ? (
                      <EventTimeline events={timeline} />
                    ) : (
                      <Muted>
                        {upcoming
                          ? "Les buts, cartons et changements apparaîtront ici pendant le match."
                          : "Aucun événement saisi pour ce match."}
                      </Muted>
                    )}
                  </section>
                  <section
                    aria-label="Statistiques"
                    className="flex flex-col gap-3"
                  >
                    <h3 className="font-heading text-base font-bold uppercase">
                      Statistiques
                    </h3>
                    {hasStats ? (
                      <div className="rounded-2xl bg-muted/60 p-4">
                        <StatsPanel stats={sheet.stats} />
                      </div>
                    ) : (
                      <Muted>Statistiques non relevées pour ce match.</Muted>
                    )}
                  </section>
                </div>
              ),
            },
            ...(group
              ? [
                  {
                    id: "classement",
                    label: "Classement",
                    panel: (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                          {group.competition.name} · {group.group.name}.{" "}
                          {group.played < group.expected
                            ? `Classement calculé sur les ${group.played} résultat${group.played > 1 ? "s" : ""} enregistré${group.played > 1 ? "s" : ""} (${group.expected} matchs au total en aller-retour).`
                            : "Tous les résultats du groupe sont enregistrés."}
                        </p>
                        <MatchTabs
                          label="Vue du classement"
                          initial="total"
                          tabs={[
                            {
                              id: "total",
                              label: "Total",
                              panel: (
                                <GroupTable
                                  rows={group.tables.all}
                                  qualifiers={group.group.qualifiers}
                                />
                              ),
                            },
                            {
                              id: "domicile",
                              label: "Domicile",
                              panel: (
                                <GroupTable
                                  rows={group.tables.home}
                                  qualifiers={group.group.qualifiers}
                                />
                              ),
                            },
                            {
                              id: "exterieur",
                              label: "Extérieur",
                              panel: (
                                <GroupTable
                                  rows={group.tables.away}
                                  qualifiers={group.group.qualifiers}
                                />
                              ),
                            },
                          ]}
                        />
                      </div>
                    ),
                  },
                  {
                    id: "journees",
                    label: "Journées",
                    panel: (
                      <GroupMatchdays
                        fixtures={group.fixtures}
                        current={`n${f.id}`}
                      />
                    ),
                  },
                ]
              : []),
            {
              id: "convoques",
              label: "Convoqués",
              panel: called ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    Liste publiée le{" "}
                    {
                      formatMatchDate(called.selection.publishedAt!).split(
                        " · ",
                      )[0]
                    }{" "}
                    :{" "}
                    <strong className="text-foreground">
                      {called.selection.title}
                    </strong>
                  </p>
                  {called.players.length === 0 ? (
                    <Muted>
                      La liste des joueurs n&apos;est pas encore détaillée.
                    </Muted>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl bg-muted/60">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th
                              scope="col"
                              className="w-12 px-3 py-2 text-left font-semibold"
                            >
                              N°
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left font-semibold"
                            >
                              Joueur
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left font-semibold"
                            >
                              Poste
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-2 text-left font-semibold"
                            >
                              Club
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {called.players.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 font-semibold tabular-nums">
                                {p.shirtNumber ?? ""}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {p.name}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {p.position ? POSITION_LABELS[p.position] : "—"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {p.club}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <Muted>
                  Aucune liste de convoqués publiée pour cette sélection avant
                  ce match.
                </Muted>
              ),
            },
            {
              id: "face-a-face",
              label: "Face-à-face",
              panel:
                h2h.items.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-4 text-center">
                      {(
                        [
                          ["Victoires du Congo", h2h.totals.wins],
                          ["Nuls", h2h.totals.draws],
                          [`Victoires ${f.opponent}`, h2h.totals.losses],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex flex-col-reverse gap-1">
                          <dt className="text-xs text-muted-foreground">{k}</dt>
                          <dd className="font-display text-3xl font-bold tabular-nums">
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <FormRows items={h2h.items} />
                  </div>
                ) : (
                  <Muted>{`Aucune rencontre précédente enregistrée entre le Congo et ${f.opponent} pour cette sélection.`}</Muted>
                ),
            },
            {
              id: "calendrier",
              label: "Calendrier",
              panel: (
                <FixtureGroups
                  items={calendar.map((c) =>
                    fromNational({
                      f: c,
                      team: team.name,
                      teamSlug: team.slug,
                    }),
                  )}
                  showDate
                />
              ),
            },
          ]}
        />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/equipes-nationales/${team.slug}`}
            className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted"
          >
            ← {team.name}
          </Link>
          <Link
            href="/matchs?competition=selections"
            className="rounded-md border bg-card px-4 py-2 font-semibold hover:bg-muted"
          >
            Tous les matchs des sélections
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
