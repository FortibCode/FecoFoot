import type { Metadata } from "next";
import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { governanceBodies, governanceMembers } from "@/lib/db/schema";
import { GOVERNANCE_BODY_KIND_LABELS } from "@/lib/governance";
import { createBody, deleteBody } from "./actions";
import { BodyForm } from "./InstanceForms";

export const metadata: Metadata = { title: "Instances et commissions — FECOFOOT" };

/** Instances de la fédération : Comité exécutif, Assemblée générale, commissions (gouvernance). */
export default async function InstancesPage() {
  await requirePermission("governance.manage");
  const bodies = await db
    .select({
      b: governanceBodies,
      active: sql<number>`(select count(*)::int from ${governanceMembers} where ${governanceMembers.bodyId} = ${governanceBodies.id} and ${governanceMembers.status} = 'ACTIVE')`,
      president: sql<string | null>`(select ${governanceMembers.fullName} from ${governanceMembers} where ${governanceMembers.bodyId} = ${governanceBodies.id} and ${governanceMembers.status} = 'ACTIVE' and ${governanceMembers.position} ilike 'président%' limit 1)`,
    })
    .from(governanceBodies)
    .orderBy(asc(governanceBodies.sortOrder), asc(governanceBodies.name));

  return (
    <>
      <PageHeader
        eyebrow="Administration · Gouvernance"
        title="Instances et commissions"
        description="Comité exécutif, Assemblée générale et commissions : composition, fonctions et mandats, publiés sur la page « La Fédération »."
        actions={
          <Link href="/federation" target="_blank" className="admin-btn admin-btn-outline">
            Page publique
          </Link>
        }
      />
      <div className="flex flex-col gap-8">
        {bodies.length === 0 ? (
          <EmptyState icon="users" title="Aucune instance" compact>
            Créez la première instance ci-dessous (ex. Comité exécutif).
          </EmptyState>
        ) : (
          <DataTable head={["Instance", "Type", "Président(e)", "Membres en fonction", "Publication", ""]}>
            {bodies.map(({ b, active, president }) => (
              <tr key={b.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/instances/${b.id}`} className="underline-offset-2 hover:underline">
                    {b.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{GOVERNANCE_BODY_KIND_LABELS[b.kind]}</td>
                <td className="px-3 py-2">{president ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{active}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={b.published ? "ok" : "wait"}>{b.published ? "Publiée" : "Masquée"}</StatusBadge>
                </td>
                <td>
                  <RowActions name={b.name} viewHref={`/admin/instances/${b.id}`} editHref={`/admin/instances/${b.id}#modifier`} onDelete={deleteBody.bind(null, b.id)} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <section id="ajouter" className="flex flex-col gap-4">
          <h2>Nouvelle instance</h2>
          <BodyForm action={createBody} submitLabel="Créer l'instance" />
        </section>
      </div>
    </>
  );
}
