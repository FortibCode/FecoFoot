import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubGrants, clubs, grantExpenses, trainingRegistrations, trainings } from "@/lib/db/schema";
import { formatFcfa } from "@/lib/format";
import { clubAttended, GRANT_STATUS_LABELS, type GrantStatus } from "@/lib/programs";
import { createGrant } from "./actions";
import { GrantForm } from "./GrantForms";

export const metadata: Metadata = { title: "Subventions aux clubs — FECOFOOT" };

const TONE: Record<GrantStatus, "ok" | "wait" | "bad"> = { DRAFT: "wait", SIGNED: "wait", PAID: "wait", CLOSED: "ok", CANCELLED: "bad" };

/** Subventions aux clubs sous convention : signature, versement, justification de l'utilisation des fonds. */
export default async function GrantsPage() {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const manage = can(user.role, "programs.manage");
  const rows = await db
    .select({
      g: clubGrants,
      club: clubs.name,
      justified: sql<number>`(select coalesce(sum(${grantExpenses.amount}), 0)::int from ${grantExpenses} where ${grantExpenses.grantId} = ${clubGrants.id} and ${grantExpenses.status} = 'ACCEPTED')`,
      toReview: sql<number>`(select count(*)::int from ${grantExpenses} where ${grantExpenses.grantId} = ${clubGrants.id} and ${grantExpenses.status} = 'SUBMITTED')`,
    })
    .from(clubGrants)
    .innerJoin(clubs, eq(clubs.id, clubGrants.clubId))
    .where(manage ? undefined : eq(clubGrants.clubId, user.clubId ?? -1))
    .orderBy(desc(clubGrants.createdAt));
  const active = rows.filter((r) => r.g.status !== "CANCELLED");
  const paid = active.filter((r) => r.g.status === "PAID" || r.g.status === "CLOSED");

  // Création (fédération) : clubs affiliés, avec les formations où ils étaient représentés (indication).
  const recentTrainings = manage ? await db.select({ id: trainings.id, title: trainings.title }).from(trainings).orderBy(desc(trainings.startDate), desc(trainings.id)).limit(10) : [];
  const regs = recentTrainings.length ? await db.select().from(trainingRegistrations).where(inArray(trainingRegistrations.trainingId, recentTrainings.map((t) => t.id))) : [];
  const clubOptions = manage
    ? (await db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.name))).map((c) => ({
        ...c,
        attended: recentTrainings.filter((t) => clubAttended(regs.filter((r) => r.trainingId === t.id), c.id)).map((t) => t.id),
      }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Services · Subventions"
        title="Subventions aux clubs"
        description="Allouées sous convention : le club signe, la fédération verse, le club justifie l'utilisation des fonds avant la clôture."
      />
      <div className="flex flex-col gap-8">
        <StatCards
          testIdPrefix="sub-"
          stats={[
            { label: "Subventions", value: active.length },
            { label: "Montant alloué", value: formatFcfa(active.reduce((s, r) => s + r.g.amount, 0)) },
            { label: "Versé", value: formatFcfa(paid.reduce((s, r) => s + r.g.amount, 0)) },
            { label: "Justifié", value: formatFcfa(paid.reduce((s, r) => s + r.justified, 0)), sub: `${rows.reduce((s, r) => s + r.toReview, 0)} justificatif(s) à examiner` },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon="document" title="Aucune subvention" compact />
        ) : (
          <DataTable head={["N°", "Club", "Programme", "Montant", "Justifié", "État"]}>
            {rows.map(({ g, club, justified, toReview }) => (
              <tr key={g.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/admin/subventions/${g.id}`} className="underline-offset-2 hover:underline">
                    {g.number}
                  </Link>
                </td>
                <td className="px-3 py-2 font-medium">{club}</td>
                <td className="px-3 py-2">{g.programme}</td>
                <td className="px-3 py-2 tabular-nums">{formatFcfa(g.amount)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {g.status === "PAID" || g.status === "CLOSED" ? `${Math.min(100, Math.round((justified / g.amount) * 100))} %` : "—"}
                  {toReview > 0 && <span className="block text-xs text-[var(--flag-red,#dc241f)]">{toReview} à examiner</span>}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge tone={TONE[g.status]}>{GRANT_STATUS_LABELS[g.status]}</StatusBadge>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        {manage && (
          <section className="flex flex-col gap-4">
            <h2>Nouvelle subvention</h2>
            {recentTrainings.length > 0 && <p className="text-sm text-muted-foreground">La présence des clubs à la formation choisie est indiquée dans la liste, à titre d&apos;information.</p>}
            <GrantForm action={createGrant} clubs={clubOptions} trainings={recentTrainings} />
          </section>
        )}
      </div>
    </>
  );
}
