import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { governanceBodies, governanceMembers } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { GOVERNANCE_BODY_KIND_LABELS, sortMembers } from "@/lib/governance";
import { addMember, deleteMember, endMemberMandate, updateBody } from "../actions";
import { BodyForm, EndMandateForm, MemberForm } from "../InstanceForms";

export const metadata: Metadata = { title: "Instance — FECOFOOT" };

/** Fiche d'une instance : membres en fonction, historique des mandats, modification. */
export default async function InstancePage({ params }: PageProps<"/admin/instances/[id]">) {
  await requirePermission("governance.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [body] = await db.select().from(governanceBodies).where(eq(governanceBodies.id, id)).limit(1);
  if (!body) notFound();
  const members = await db.select().from(governanceMembers).where(eq(governanceMembers.bodyId, id)).orderBy(asc(governanceMembers.fullName));
  const active = sortMembers(members.filter((m) => m.status === "ACTIVE"));
  const past = members.filter((m) => m.status === "ENDED").sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));

  return (
    <>
      <PageHeader
        eyebrow={`Gouvernance · ${GOVERNANCE_BODY_KIND_LABELS[body.kind]}`}
        title={body.name}
        description={`${active.length} membre(s) en fonction${body.published ? "" : " · masquée sur la page publique"}`}
        actions={
          <Link href="/admin/instances" className="admin-btn admin-btn-outline">
            ← Instances
          </Link>
        }
      />
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2>Membres en fonction</h2>
          {active.length === 0 ? (
            <EmptyState icon="users" title="Aucun membre en fonction" compact />
          ) : (
            <DataTable head={["Nom", "Fonction", "Depuis", "Référence", ""]}>
              {active.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium">{m.fullName}</td>
                  <td className="px-3 py-2">{m.position}</td>
                  <td className="px-3 py-2 tabular-nums">{m.startDate ? formatDate(new Date(`${m.startDate}T12:00:00`)) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.source ?? "—"}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <EndMandateForm action={endMemberMandate.bind(null, id, m.id)} who={m.fullName} />
                      <RowActions name={m.fullName} onDelete={deleteMember.bind(null, id, m.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Ajouter un membre</h2>
          <MemberForm action={addMember.bind(null, id)} />
        </section>

        {past.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2>Historique des mandats</h2>
            <DataTable head={["Nom", "Fonction", "Mandat", "Référence"]}>
              {past.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium">{m.fullName}</td>
                  <td className="px-3 py-2">{m.position}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {m.startDate ? formatDate(new Date(`${m.startDate}T12:00:00`)) : "?"} → {m.endDate ? formatDate(new Date(`${m.endDate}T12:00:00`)) : "?"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.source ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </section>
        )}

        <section id="modifier" className="flex flex-col gap-4">
          <h2>Modifier l&apos;instance</h2>
          <BodyForm action={updateBody.bind(null, id)} initial={body} submitLabel="Enregistrer" />
        </section>
      </div>
    </>
  );
}
