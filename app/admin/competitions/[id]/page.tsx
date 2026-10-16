import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { MatchLine } from "@/components/competitions/match-line";
import { ScorersList, StandingsTable } from "@/components/competitions/standings-table";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { COMPETITION_STATUS_LABELS, COMPETITION_TYPE_LABELS, roundLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitionTeams, matches } from "@/lib/db/schema";
import { CATEGORY_LABELS, seasonLabel } from "@/lib/licenses";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";
import { drawCup, engageClub, generateFixtures, setCompetitionStatus, setPenalty, withdrawClub } from "../actions";
import { EngageForm, PenaltyForm, StatusSelectForm } from "../CompetitionForms";

export const metadata: Metadata = { title: "Compétition — FECOFOOT" };

export default async function CompetitionPage({ params }: PageProps<"/admin/competitions/[id]">) {
  await requirePermission("competitions.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const data = await competitionTables(id);
  if (!data) notFound();
  const { competition: c, tables, scorers } = data;

  const [engaged, allMatches, affiliated] = await Promise.all([
    db
      .select({ team: competitionTeams, name: clubs.name })
      .from(competitionTeams)
      .innerJoin(clubs, eq(competitionTeams.clubId, clubs.id))
      .where(eq(competitionTeams.competitionId, id))
      .orderBy(asc(competitionTeams.pool), asc(clubs.name)),
    matchQuery().where(eq(matches.competitionId, id)).orderBy(asc(matches.round), asc(matches.bracketSlot), asc(matches.kickoffAt), asc(matches.id)),
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.name)),
  ]);
  const hasMatches = allMatches.length > 0;
  const engagedIds = new Set(engaged.map((e) => e.team.clubId));
  const rounds = [...new Set(allMatches.map((m) => m.match.round))];
  const totalRounds = Math.max(0, ...rounds);

  return (
    <>
      <PageHeader
        eyebrow={`Sport · ${seasonLabel(c.season)}`}
        title={c.name}
        description={`${COMPETITION_TYPE_LABELS[c.type]} · ${CATEGORY_LABELS[c.category]}${c.gender === "F" ? " · Féminin" : ""} · barème ${c.pointsWin}/${c.pointsDraw}/${c.pointsLoss} · ${COMPETITION_STATUS_LABELS[c.status]}`}
        actions={
          <>
            <a href={`/admin/exports/classement/${c.id}?format=xlsx`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Excel
            </a>
            <a href={`/admin/exports/classement/${c.id}?format=pdf`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              PDF
            </a>
            <Link href={`/competitions/${c.slug}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Page publique
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-10">
        {/* Engagements (EF-CMP-02) */}
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Clubs engagés ({engaged.length})</h2>
          <ul className="flex flex-col divide-y rounded-lg border">
            {engaged.map(({ team, name }) => (
              <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {team.pool && <span className="mr-2 rounded bg-muted px-1.5 text-xs font-semibold">Poule {team.pool}</span>}
                  {team.drawOrder && <span className="mr-2 text-xs text-muted-foreground">tiré n°{team.drawOrder}</span>}
                  <strong>{name}</strong>
                  {team.pointsPenalty > 0 && (
                    <span className="ml-2 text-xs text-destructive">
                      −{team.pointsPenalty} pts ({team.penaltyReason})
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {c.type === "LEAGUE" && <PenaltyForm action={setPenalty.bind(null, c.id, team.clubId)} current={team.pointsPenalty} />}
                  {!hasMatches && (
                    <form action={withdrawClub.bind(null, c.id, team.clubId)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Retirer
                      </Button>
                    </form>
                  )}
                </span>
              </li>
            ))}
            {engaged.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun club engagé.</li>}
          </ul>
          {!hasMatches && (
            <>
              <EngageForm action={engageClub.bind(null, c.id)} clubs={affiliated.filter((a) => !engagedIds.has(a.id))} pools={c.type === "LEAGUE"} />
              {c.type === "LEAGUE" ? (
                <ActionForm action={generateFixtures.bind(null, c.id)} label="Générer le calendrier" variant="default" />
              ) : (
                <ActionForm action={drawCup.bind(null, c.id)} label="Effectuer le tirage au sort" variant="default" />
              )}
            </>
          )}
        </section>

        {/* Classement et buteurs (EF-CMP-06) */}
        {c.type === "LEAGUE" && hasMatches && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="font-semibold">Classement</h2>
              {tables.map((t) => (
                <StandingsTable key={t.pool} rows={t.rows} title={t.pool ? `Poule ${t.pool}` : undefined} />
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="font-semibold">Meilleurs buteurs</h2>
              <ScorersList scorers={scorers} />
            </div>
          </section>
        )}

        {/* Calendrier et résultats (EF-CMP-03, EF-CMP-04) */}
        {hasMatches && (
          <section className="flex flex-col gap-4">
            <h2 className="font-semibold">{c.type === "CUP" ? "Tableau" : "Calendrier et résultats"}</h2>
            {rounds.map((r) => (
              <div key={r} className="overflow-hidden rounded-lg border">
                <p className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
                  {c.type === "CUP" ? roundLabel(r, totalRounds) : `Journée ${r}`}
                </p>
                <div className="divide-y">
                  {allMatches
                    .filter((m) => m.match.round === r)
                    .map((m) => (
                      <MatchLine key={m.match.id} row={m} href={`/admin/matchs/${m.match.id}`} />
                    ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="border-t pt-6">
          <StatusSelectForm action={setCompetitionStatus.bind(null, c.id)} current={c.status} options={COMPETITION_STATUS_LABELS} label="Statut de la compétition" />
        </section>
      </div>
    </>
  );
}
