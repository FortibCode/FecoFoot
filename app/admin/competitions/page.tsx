import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { COMPETITION_STATUS_LABELS, COMPETITION_TYPE_LABELS } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, competitionTeams } from "@/lib/db/schema";
import { CATEGORY_LABELS, seasonLabel } from "@/lib/licenses";

export const metadata: Metadata = { title: "Compétitions — FECOFOOT" };

export default async function CompetitionsPage() {
  await requirePermission("competitions.manage");
  const rows = await db
    .select({ c: competitions, teams: count(competitionTeams.id) })
    .from(competitions)
    .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
    .groupBy(competitions.id)
    .orderBy(desc(competitions.season), competitions.name);

  return (
    <>
      <PageHeader
        eyebrow="Sport"
        title="Compétitions"
        description="Championnats, coupes et tournois : engagements, calendrier, feuilles de match, classements."
        actions={
          <Link href="/admin/competitions/nouveau" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Nouvelle compétition
          </Link>
        }
      />
      <DataTable head={["Compétition", "Saison", "Type", "Catégorie", "Clubs", "Statut"]}>
        {rows.map(({ c, teams }) => (
          <tr key={c.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/competitions/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="px-3 py-2">{seasonLabel(c.season)}</td>
            <td className="px-3 py-2">{COMPETITION_TYPE_LABELS[c.type]}</td>
            <td className="px-3 py-2">
              {CATEGORY_LABELS[c.category]} {c.gender === "F" ? "· Féminin" : ""}
            </td>
            <td className="px-3 py-2">{teams}</td>
            <td className="px-3 py-2">{COMPETITION_STATUS_LABELS[c.status]}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
