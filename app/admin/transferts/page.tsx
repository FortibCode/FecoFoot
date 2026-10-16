import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge, transferTone } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { transfers } from "@/lib/db/schema";
import { formatDate, formatFcfa } from "@/lib/format";
import { transferQuery, transferScope } from "@/lib/queries/transfers";
import { needsRelease, TRANSFER_STATUS_LABELS, TRANSFER_STATUSES, TRANSFER_TYPE_LABELS, type TransferStatus } from "@/lib/transfers";

export const metadata: Metadata = { title: "Transferts — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function TransfersPage({ searchParams }: PageProps<"/admin/transferts">) {
  const user = await requireAnyPermission("transfers.review", "transfers.approve", "transfers.release");
  const requested = one((await searchParams).status);
  const status = TRANSFER_STATUSES.find((s) => s === requested) as TransferStatus | undefined;

  const filters: SQL[] = [];
  const scope = transferScope(user);
  if (scope) filters.push(scope);
  if (status) filters.push(eq(transfers.status, status));
  const rows = await transferQuery()
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(transfers.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        eyebrow="Licences"
        title="Transferts"
        description="La ligue instruit la demande, la fédération approuve ou refuse."
        actions={
          <>
            {can(user.role, "transfers.approve") && (
              <Link href="/admin/transferts/fenetres" className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted">
                Fenêtres
              </Link>
            )}
            {can(user.role, "transfers.review") && (
              <Link href="/admin/transferts/nouveau" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Nouvelle demande
              </Link>
            )}
          </>
        }
      />
      <form className="mb-4 flex items-end gap-2 text-sm">
        <SelectField label="Statut" name="status" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          {TRANSFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRANSFER_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
          Filtrer
        </button>
      </form>
      <DataTable head={["N°", "Joueur", "Mouvement", "Type", "Indemnité", "Date", "Statut"]}>
        {rows.map(({ transfer: t, player, fromClub, toClub }) => (
          <tr key={t.id}>
            <td className="px-3 py-2 font-mono text-xs">
              <Link href={`/admin/transferts/${t.id}`} className="underline-offset-2 hover:underline">
                {t.number}
              </Link>
            </td>
            <td className="px-3 py-2 font-medium">
              {player.lastName} {player.firstName}
            </td>
            <td className="px-3 py-2">
              {fromClub?.name ?? "Sans club"} → {toClub.name}
            </td>
            <td className="px-3 py-2">{TRANSFER_TYPE_LABELS[t.type]}</td>
            <td className="px-3 py-2">{formatFcfa(t.fee)}</td>
            <td className="px-3 py-2">{formatDate(t.createdAt)}</td>
            <td className="px-3 py-2">
              <StatusBadge tone={transferTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</StatusBadge>
              {t.status === "PENDING" && needsRelease(t) && t.releaseGranted === null && (
                <p className="mt-1 text-xs text-muted-foreground">Accord du club quitté attendu</p>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
