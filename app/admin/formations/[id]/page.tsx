import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, leagues, trainingRegistrations, trainings } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { TRAINING_ROLE_LABELS, trainingDays } from "@/lib/programs";
import { cancelRegistration, registerDelegate, toggleAttendance, updateTraining } from "../actions";
import { AttendanceToggle, RegistrationForm, TrainingForm } from "../FormationForms";

export const metadata: Metadata = { title: "Formation — FECOFOOT" };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Fiche d'une formation : inscriptions (de sa structure ou toutes), présence jour par jour, modification. */
export default async function TrainingPage({ params }: PageProps<"/admin/formations/[id]">) {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const manage = can(user.role, "programs.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [t] = await db.select().from(trainings).where(eq(trainings.id, id)).limit(1);
  if (!t) notFound();
  const scope: SQL | undefined = manage ? undefined : user.role === "CLUB" ? eq(trainingRegistrations.clubId, user.clubId ?? -1) : eq(trainingRegistrations.leagueId, user.leagueId ?? -1);
  const [regs, clubList, leagueList] = await Promise.all([
    db
      .select({ r: trainingRegistrations, club: clubs.name, league: leagues.name })
      .from(trainingRegistrations)
      .leftJoin(clubs, eq(clubs.id, trainingRegistrations.clubId))
      .leftJoin(leagues, eq(leagues.id, trainingRegistrations.leagueId))
      .where(and(eq(trainingRegistrations.trainingId, id), eq(trainingRegistrations.status, "REGISTERED"), scope))
      .orderBy(asc(clubs.name), asc(leagues.name), asc(trainingRegistrations.fullName)),
    manage ? db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.name)) : Promise.resolve([]),
    manage ? db.select({ id: leagues.id, name: leagues.name }).from(leagues).orderBy(asc(leagues.name)) : Promise.resolve([]),
  ]);
  const days = trainingDays(t.startDate, t.endDate);
  const clubsRepresented = new Set(regs.filter((x) => x.r.clubId && x.r.presentDays.length > 0).map((x) => x.r.clubId)).size;
  const label = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

  return (
    <>
      <PageHeader
        eyebrow={`Formation · ${t.organizer}`}
        title={t.title}
        description={`${formatDate(new Date(`${t.startDate}T12:00:00`))} → ${formatDate(new Date(`${t.endDate}T12:00:00`))} · ${t.location}`}
        actions={
          <Link href="/admin/formations" className="admin-btn admin-btn-outline">
            ← Formations
          </Link>
        }
      />
      <div className="flex flex-col gap-8">
        {manage && (
          <StatCards
            testIdPrefix="tr-"
            stats={[
              { label: "Inscrits", value: regs.length, sub: t.capacity ? `sur ${t.capacity} places` : "places illimitées" },
              ...days.map((d) => ({ label: `Présents ${label(d)}`, value: regs.filter((x) => x.r.presentDays.includes(d)).length })),
              { label: "Clubs représentés", value: clubsRepresented, sub: "au moins un dirigeant présent" },
            ]}
          />
        )}
        {t.modules.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2>Programme</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {t.modules.map((m) => (
                <li key={m} className="rounded-full border bg-card px-3 py-1">
                  {m}
                </li>
              ))}
            </ul>
            {t.description && <p className="max-w-3xl text-sm whitespace-pre-line text-muted-foreground">{t.description}</p>}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2>{manage ? "Inscrits et présence" : "Vos inscrits"}</h2>
          {regs.length === 0 ? (
            <EmptyState icon="users" title="Aucun inscrit" compact />
          ) : (
            <DataTable head={["Nom", "Fonction", "Structure", "Contact", ...days.map(label), ""]}>
              {regs.map(({ r, club, league }) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.fullName}</td>
                  <td className="px-3 py-2">{TRAINING_ROLE_LABELS[r.role]}</td>
                  <td className="px-3 py-2">{club ?? league ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
                  {days.map((d) =>
                    manage ? (
                      <td key={d} className="px-2 py-2">
                        <AttendanceToggle action={toggleAttendance.bind(null, r.id, d)} present={r.presentDays.includes(d)} label={`Présence de ${r.fullName} le ${label(d)}`} />
                      </td>
                    ) : (
                      <td key={d} className="px-2 py-2">
                        <StatusBadge tone={r.presentDays.includes(d) ? "ok" : "wait"}>{r.presentDays.includes(d) ? "Présent" : "—"}</StatusBadge>
                      </td>
                    ),
                  )}
                  <td>
                    <RowActions name={`l'inscription de ${r.fullName}`} onDelete={cancelRegistration.bind(null, r.id)} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section id="inscrire" className="flex flex-col gap-3">
          <h2>Inscrire un dirigeant</h2>
          {t.registrationOpen ? (
            <RegistrationForm action={registerDelegate.bind(null, id)} scope={manage ? "federation" : user.role === "CLUB" ? "club" : "league"} clubs={clubList} leagues={leagueList} />
          ) : (
            <p className="text-sm text-muted-foreground">Les inscriptions sont closes.</p>
          )}
        </section>

        {manage && (
          <section id="modifier" className="flex flex-col gap-4">
            <h2>Modifier la formation</h2>
            <TrainingForm action={updateTraining.bind(null, id)} initial={t} submitLabel="Enregistrer" />
          </section>
        )}
      </div>
    </>
  );
}
