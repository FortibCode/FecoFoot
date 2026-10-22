import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge, transferTone } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { players, transfers } from "@/lib/db/schema";
import { formatDate, formatFcfa } from "@/lib/format";
import { fromClub, toClub, transferQuery, transferScope } from "@/lib/queries/transfers";
import { needsRelease, TRANSFER_STATUS_LABELS, TRANSFER_STATUSES, TRANSFER_TYPE_LABELS, type TransferStatus } from "@/lib/transfers";

export const metadata: Metadata = { title: "Transferts — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function TransfersPage({ searchParams }: PageProps<"/admin/transferts">) {
  const user = await requireAnyPermission("transfers.review", "transfers.approve", "transfers.release");
  const sp = await searchParams;
  const requested = one(sp.status);
  const status = TRANSFER_STATUSES.find((s) => s === requested) as TransferStatus | undefined;
  const q = one(sp.q);

  const filters: SQL[] = [];
  const scope = transferScope(user);
  if (scope) filters.push(scope);
  if (status) filters.push(eq(transfers.status, status));
  // Recherche : joueur (nom, prénom, identifiant fédéral), numéro de transfert ou club.
  if (q) {
    filters.push(
      or(
        ilike(players.lastName, `%${q}%`),
        ilike(players.firstName, `%${q}%`),
        ilike(players.federalId, `%${q}%`),
        ilike(transfers.number, `%${q}%`),
        ilike(fromClub.name, `%${q}%`),
        ilike(toClub.name, `%${q}%`),
      )!,
    );
  }
  const byStatus = await db
    .select({ status: transfers.status, n: count() })
    .from(transfers)
    .innerJoin(fromClub, eq(transfers.fromClubId, fromClub.id))
    .innerJoin(toClub, eq(transfers.toClubId, toClub.id))
    .where(scope)
    .groupBy(transfers.status);
  const nOf = (st: TransferStatus) => byStatus.find((r) => r.status === st)?.n ?? 0;
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
              <Link href="/admin/transferts/fenetres" className="admin-btn admin-btn-outline">
                Fenêtres
              </Link>
            )}
            {can(user.role, "transfers.review") && (
              <Link href="/admin/transferts/nouveau" className="admin-btn admin-btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden><path d="M12 5v14m-7-7h14" /></svg>
                Nouvelle demande
              </Link>
            )}
          </>
        }
      />
      <StatCards
        label="Transferts par statut"
        stats={(["PENDING", "FORWARDED", "APPROVED", "REFUSED"] as const).map((st) => ({
          label: TRANSFER_STATUS_LABELS[st],
          value: nOf(st),
          href: status === st ? "/admin/transferts" : `/admin/transferts?status=${st}`,
          active: status === st,
        }))}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Joueur, n° de transfert, club" className="admin-input" style={{ maxWidth: 240 }} />
        </label>
        <SelectField label="Statut" name="status" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          {TRANSFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TRANSFER_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["N°", "Joueur", "Mouvement", "Type", "Indemnité", "Date", "Statut", ""]} pageSize={5}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="text-center text-muted-foreground">
              Aucun transfert ne correspond.
            </td>
          </tr>
        )}
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
            <td>
              <RowActions name={t.number} viewHref={`/admin/transferts/${t.id}`} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
