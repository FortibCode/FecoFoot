import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { trainingRegistrations, trainings } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { createTraining } from "./actions";
import { TrainingForm } from "./FormationForms";

export const metadata: Metadata = { title: "Formations — FECOFOOT" };

const day = (d: string) => formatDate(new Date(`${d}T12:00:00`));

/** Formations des dirigeants : organisées par la fédération, inscriptions par les clubs et les ligues. */
export default async function TrainingsPage() {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const manage = can(user.role, "programs.manage");
  // Inscriptions comptées : toutes (fédération) ou celles de sa structure (club, ligue).
  const mine = manage
    ? sql`true`
    : user.role === "CLUB"
      ? sql`${trainingRegistrations.clubId} = ${user.clubId ?? -1}`
      : sql`${trainingRegistrations.leagueId} = ${user.leagueId ?? -1}`;
  const rows = await db
    .select({
      t: trainings,
      registered: sql<number>`(select count(*)::int from ${trainingRegistrations} where ${trainingRegistrations.trainingId} = ${trainings.id} and ${trainingRegistrations.status} = 'REGISTERED' and ${mine})`,
    })
    .from(trainings)
    .orderBy(desc(trainings.startDate));

  return (
    <>
      <PageHeader
        eyebrow="Services · Formations"
        title="Formations"
        description={manage ? "Formations des dirigeants de clubs et de ligues : inscriptions et présence." : "Inscrivez les dirigeants de votre structure aux formations de la fédération."}
      />
      <div className="flex flex-col gap-8">
        {rows.length === 0 ? (
          <EmptyState icon="calendar" title="Aucune formation" compact />
        ) : (
          <DataTable head={["Formation", "Dates", "Lieu", manage ? "Inscrits" : "Vos inscrits", "Inscriptions"]}>
            {rows.map(({ t, registered }) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/formations/${t.id}`} className="underline-offset-2 hover:underline">
                    {t.title}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{t.organizer}</span>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {day(t.startDate)}
                  {t.endDate !== t.startDate && ` → ${day(t.endDate)}`}
                </td>
                <td className="px-3 py-2">{t.location}</td>
                <td className="px-3 py-2 tabular-nums">
                  {registered}
                  {manage && t.capacity ? ` / ${t.capacity}` : ""}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge tone={t.registrationOpen ? "ok" : "wait"}>{t.registrationOpen ? "Ouvertes" : "Closes"}</StatusBadge>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        {manage && (
          <section className="flex flex-col gap-4">
            <h2>Nouvelle formation</h2>
            <TrainingForm action={createTraining} submitLabel="Créer la formation" />
          </section>
        )}
      </div>
    </>
  );
}
