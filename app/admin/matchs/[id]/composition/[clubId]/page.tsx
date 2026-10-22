import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { matches, matchLineups } from "@/lib/db/schema";
import { formatDateTime, isPast } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { canManageMatch, eligiblePlayers, matchQuery } from "@/lib/queries/competitions";
import { suspendedPlayers } from "@/lib/queries/discipline";
import { saveLineup } from "../../../actions";
import { LineupForm } from "./LineupForm";

export const metadata: Metadata = { title: "Composition d'équipe — FECOFOOT" };

/** Composition d'équipe saisie par le club avant le match (EF-CMP-07). */
export default async function LineupPage({ params }: PageProps<"/admin/matchs/[id]/composition/[clubId]">) {
  const user = await requireUser();
  const p = await params;
  const matchId = Number(p.id);
  const clubId = Number(p.clubId);
  const [row] = await matchQuery().where(eq(matches.id, matchId)).limit(1);
  if (!row || (row.match.homeClubId !== clubId && row.match.awayClubId !== clubId)) notFound();
  const own = can(user.role, "lineups.submit") && user.clubId === clubId;
  if (!own && !(await canManageMatch(user, matchId))) redirect("/admin/acces-refuse");

  const [eligible, current, suspended] = await Promise.all([
    eligiblePlayers(clubId, row.competition.season),
    db.select().from(matchLineups).where(and(eq(matchLineups.matchId, matchId), eq(matchLineups.clubId, clubId))),
    suspendedPlayers(clubId, row.competition.id),
  ]);
  const byPlayer = new Map(current.map((l) => [l.playerId, l]));
  const team = row.match.homeClubId === clubId ? row.home : row.away;
  const locked = isPast(row.match.kickoffAt);

  return (
    <>
      <PageHeader
        eyebrow={`${row.competition.name} · composition`}
        title={team?.name ?? ""}
        description={`${row.home?.name} – ${row.away?.name} · ${row.match.kickoffAt ? formatDateTime(row.match.kickoffAt) : "date à fixer"}. Seuls les joueurs titulaires d'une licence validée pour la saison sont proposés.`}
      />
      {locked ? (
        <p className="text-sm text-muted-foreground">Le match a commencé : la composition ne peut plus être modifiée.</p>
      ) : eligible.length === 0 ? (
        <EmptyState icon="users" title="Aucun joueur qualifié">Seuls les joueurs ayant une licence validée pour la saison peuvent figurer sur la feuille de match.</EmptyState>
      ) : (
        <LineupForm
          action={saveLineup.bind(null, matchId, clubId)}
          rows={eligible
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((pl) => ({
              id: pl.id,
              name: `${pl.lastName} ${pl.firstName}`,
              position: pl.position ? POSITION_LABELS[pl.position] : "",
              selected: byPlayer.has(pl.id),
              starter: byPlayer.get(pl.id)?.starter ?? false,
              shirtNumber: byPlayer.get(pl.id)?.shirtNumber ?? null,
              suspended: suspended.get(pl.id) ?? null,
            }))}
        />
      )}
      <Link href={`/admin/matchs/${matchId}`} className="mt-6 inline-block text-sm underline">
        Retour au match
      </Link>
    </>
  );
}
