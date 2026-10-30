import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatsForm } from "@/components/matches/stats-form";
import { requirePermission } from "@/lib/auth/guard";
import { EVENT_TYPE_LABELS, type MatchStatValues } from "@/lib/competitions";
import { db } from "@/lib/db";
import { matchStats, nationalEvents, nationalFixtures, nationalLineups, nationalTeams, selections } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { calledPlayers } from "@/lib/queries/national";
import type { StatPeriod } from "@/lib/match-stats";
import { addNationalEvent, deleteNationalEvent, saveFixtureStats, saveNationalLineup, setFixtureResult } from "../../../actions";
import { FixtureResultForm, NationalEventForm, NationalLineupForm } from "../../../SelectionForms";

export const metadata: Metadata = { title: "Feuille de match — sélection — FECOFOOT" };

/** Feuille de match d'une sélection : résultat, composition (publiable), événements, statistiques. */
export default async function NationalMatchSheetPage({ params }: PageProps<"/admin/selections/[code]/matchs/[id]">) {
  await requirePermission("national_teams.manage");
  const { code, id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const [team] = await db.select().from(nationalTeams).where(eq(nationalTeams.code, code)).limit(1);
  if (!team) notFound();
  const [f] = await db.select().from(nationalFixtures).where(and(eq(nationalFixtures.id, id), eq(nationalFixtures.teamId, team.id))).limit(1);
  if (!f) notFound();
  // Convoqués de la liste la plus récente de la sélection (base de la composition).
  const [latest] = await db.select().from(selections).where(eq(selections.teamId, team.id)).orderBy(desc(selections.createdAt)).limit(1);
  const [called, lineup, events, stats] = await Promise.all([
    latest ? calledPlayers(latest.id) : Promise.resolve([]),
    db.select().from(nationalLineups).where(eq(nationalLineups.fixtureId, f.id)),
    db.select().from(nationalEvents).where(eq(nationalEvents.fixtureId, f.id)).orderBy(asc(nationalEvents.minute), asc(nationalEvents.id)),
    db.select().from(matchStats).where(eq(matchStats.fixtureId, f.id)),
  ]);
  const inLineup = new Map(lineup.map((l) => [l.selectionPlayerId, l]));
  const [home, away] = f.isHome ? ["Congo", f.opponent] : [f.opponent, "Congo"];
  const statValues = Object.fromEntries(stats.map(({ period, ...v }) => [period, v as unknown as MatchStatValues])) as Partial<Record<StatPeriod, MatchStatValues>>;
  const congoPlayers = (lineup.length ? lineup.map((l) => l.name) : called.map((c) => c.name)).filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={`${team.name} · feuille de match`}
        title={`${home} – ${away}`}
        description={`${formatDateTime(f.kickoffAt)}${f.venue ? ` · ${f.venue}` : ""}${f.competition ? ` · ${f.competition}` : ""}`}
        actions={
          <Link href={`/matchs/selection/${f.id}`} target="_blank" className="admin-btn admin-btn-outline">
            Fiche publique
          </Link>
        }
      />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2>Résultat</h2>
          <FixtureResultForm action={setFixtureResult.bind(null, team.code, f.id)} current={f} />
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2>Composition du Congo</h2>
            <p className="text-sm text-muted-foreground">
              {latest ? `Convoqués de la liste « ${latest.title} ».` : "Créez d'abord une liste de convoqués."} La composition apparaît sur la fiche publique une fois publiée.
            </p>
          </div>
          {called.length > 0 && (
            <NationalLineupForm
              action={saveNationalLineup.bind(null, team.code, f.id)}
              formation={f.formation}
              published={f.lineupPublished}
              rows={called.map((c) => {
                const l = inLineup.get(c.id);
                return {
                  id: c.id,
                  name: c.name,
                  club: c.club,
                  position: l?.position ?? c.position,
                  shirtNumber: l?.shirtNumber ?? c.shirtNumber,
                  role: l ? (l.starter ? "starter" : "sub") : "none",
                  captain: l?.captain ?? false,
                };
              })}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Événements du match</h2>
          {events.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <strong className="tabular-nums">{e.minute}&apos;</strong> · {EVENT_TYPE_LABELS[e.type]} · {e.player}
                    {e.secondPlayer && <span className="text-muted-foreground"> ({e.type === "SUBSTITUTION" ? `entre ${e.secondPlayer}` : `passe de ${e.secondPlayer}`})</span>}
                    <span className="text-muted-foreground"> — {e.side === "CONGO" ? "Congo" : f.opponent}</span>
                  </span>
                  <RowActions name={`${e.minute}' ${e.player}`} onDelete={deleteNationalEvent.bind(null, team.code, f.id, e.id)} />
                </li>
              ))}
            </ul>
          )}
          <NationalEventForm action={addNationalEvent.bind(null, team.code, f.id)} congoPlayers={congoPlayers} opponent={f.opponent} />
        </section>

        <section className="flex flex-col gap-3">
          <h2>Statistiques du match</h2>
          <StatsForm action={saveFixtureStats.bind(null, team.code, f.id)} teams={[home, away]} values={statValues} />
        </section>

        <Link href={`/admin/selections/${team.code}`} className="text-sm underline">
          Retour à la sélection
        </Link>
      </div>
    </>
  );
}
