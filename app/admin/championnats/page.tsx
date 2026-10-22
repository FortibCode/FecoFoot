import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { canAccessCompetition } from "@/lib/auth/roles";
import { COMPETITION_STATUS_LABELS } from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import { championshipsWithSeasons } from "@/lib/queries/championships";

export const metadata: Metadata = { title: "Championnats nationaux — FECOFOOT" };

/** Ligue 1 et Ligue 2 nationales : saison en cours et historique de chaque championnat. */
export default async function ChampionshipsPage() {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) redirect("/admin/acces-refuse");
  const list = await championshipsWithSeasons();

  return (
    <>
      <PageHeader
        eyebrow="Sport"
        title="Championnats nationaux"
        description="Ligue 1 et Ligue 2 : saisons, clubs participants, zones ou groupes, calendrier, résultats, classements, montées et descentes, responsables et règlements."
      />
      <StatCards
        stats={list.map((ch) => {
          const current = ch.seasons[0];
          return {
            label: ch.name,
            value: current ? current.teams : 0,
            sub: current ? `clubs · saison ${seasonLabel(current.c.season)}` : "aucune saison créée",
          };
        })}
      />
      <ul className="team-cards">
        {list.map((ch) => {
          const current = ch.seasons[0];
          return (
            <li key={ch.id}>
              <Link href={`/admin/championnats/${ch.code}`} className="team-card" data-testid="championship-card">
                <span className="team-card-flag" aria-hidden />
                <span className="team-card-head">
                  <span className="team-card-name">{ch.name}</span>
                  <span className="team-card-arrow" aria-hidden>
                    →
                  </span>
                </span>
                <span className="team-card-metrics">
                  <span>
                    <strong>{ch.seasons.length}</strong> saison(s)
                  </span>
                  <span>
                    <strong>{current?.teams ?? 0}</strong> club(s)
                  </span>
                  <span>
                    niveau <strong>{ch.tier}</strong>
                  </span>
                </span>
                <span className={`team-card-next${current ? "" : " is-empty"}`}>
                  {current ? (
                    <>
                      <span className="team-card-next-label">Saison {seasonLabel(current.c.season)}</span>
                      <StatusBadge tone={current.c.status === "ONGOING" ? "ok" : current.c.status === "DRAFT" ? "wait" : "neutral"}>
                        {COMPETITION_STATUS_LABELS[current.c.status]}
                      </StatusBadge>
                    </>
                  ) : (
                    "Aucune saison : créez la première depuis la fiche du championnat."
                  )}
                </span>
                {!ch.active && <span className="text-xs text-muted-foreground">Masqué du portail</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
