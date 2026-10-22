import type { Metadata } from "next";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { formatDateTime, formatFcfa } from "@/lib/format";
import { paymentMode } from "@/lib/payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_PURPOSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/payments-rules";
import { listPayments, payerLabel, paymentFilters, paymentQueryString, paymentSummary, paymentTargetHref } from "@/lib/queries/payments";
import { formatCongoPhone } from "@/lib/supporters";
import { expirePendingPayments } from "./actions";

export const metadata: Metadata = { title: "Paiements — FECOFOOT" };

const PAGE_SIZE = 5;
const TONE: Record<PaymentStatus, "ok" | "wait" | "bad" | "neutral"> = { SUCCEEDED: "ok", PENDING: "wait", FAILED: "bad", EXPIRED: "neutral", REFUNDED: "neutral" };

/** Trésorerie : encaissements Mobile Money et guichet, rapprochement, export (M16). */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/paiements">) {
  await requirePermission("payments.manage");
  const sp = await searchParams;
  const filters = paymentFilters((k) => sp[k]);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total }, summary] = await Promise.all([listPayments(filters, page, PAGE_SIZE), paymentSummary(filters)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = paymentQueryString(filters);
  const pageHref = (p: number) => {
    const q = new URLSearchParams(qs);
    q.set("page", String(p));
    return `/admin/paiements?${q}`;
  };
  const ok = summary.byStatus.SUCCEEDED ?? { n: 0, amount: 0 };
  const pending = summary.byStatus.PENDING ?? { n: 0, amount: 0 };
  const failed = (summary.byStatus.FAILED?.n ?? 0) + (summary.byStatus.EXPIRED?.n ?? 0);
  const refunded = summary.byStatus.REFUNDED ?? { n: 0, amount: 0 };
  const kpis = [
    ["Encaissé", formatFcfa(ok.amount), `${ok.n} paiement(s) réussi(s)`],
    ["En attente", formatFcfa(pending.amount), `${pending.n} paiement(s)`],
    ["Échoués ou expirés", String(failed), "paiement(s) non aboutis"],
    ["Remboursé", formatFcfa(refunded.amount), `${refunded.n} paiement(s)`],
  ] as const;
  const select = "h-9 rounded-md border bg-background px-2 text-sm";

  return (
    <>
      <PageHeader
        eyebrow="Trésorerie"
        title="Paiements"
        description={`${total} paiement(s) · mode ${paymentMode() === "simulation" ? "simulation (aucun débit réel)" : "production"}`}
        actions={
          <a href={`/admin/paiements/export?${qs}`} className="admin-btn admin-btn-outline">
            Exporter (Excel)
          </a>
        }
      />

      <div className="flex flex-col gap-8">
        <StatCards label="Synthèse" testIdPrefix="kpi-" stats={kpis.map(([label, value, sub]) => ({ label, value, sub }))} />

        {(summary.byPurpose.length > 0 || summary.byMethod.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ["Encaissé par objet", summary.byPurpose.map((r) => [PAYMENT_PURPOSE_LABELS[r.purpose], r.n, r.amount] as const)],
                ["Encaissé par moyen de paiement", summary.byMethod.map((r) => [PAYMENT_METHOD_LABELS[r.method], r.n, r.amount] as const)],
              ] as const
            ).map(([title, items]) => (
              <section key={title} className="rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-heading text-base font-semibold uppercase">{title}</h2>
                <ul className="flex flex-col gap-2.5">
                  {items.map(([label, n, amount]) => (
                    <li key={label} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span>
                          {label} <span className="text-muted-foreground">· {n}</span>
                        </span>
                        <span className="font-semibold tabular-nums">{formatFcfa(amount)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[var(--flag-green)]" style={{ width: `${ok.amount ? (amount / ok.amount) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && <li className="text-sm text-muted-foreground">Aucun encaissement.</li>}
                </ul>
              </section>
            ))}
          </div>
        )}

        <form className="flex flex-wrap items-end gap-2 text-sm" aria-label="Filtres">
          <label className="flex flex-col gap-1">
            Objet
            <select name="objet" defaultValue={filters.purpose ?? ""} className={select}>
              <option value="">Tous</option>
              {PAYMENT_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_PURPOSE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            État
            <select name="etat" defaultValue={filters.status ?? ""} className={select}>
              <option value="">Tous</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Moyen
            <select name="moyen" defaultValue={filters.method ?? ""} className={select}>
              <option value="">Tous</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Du
            <input type="date" name="du" defaultValue={filters.from} className={select} />
          </label>
          <label className="flex flex-col gap-1">
            Au
            <input type="date" name="au" defaultValue={filters.to} className={select} />
          </label>
          <label className="flex flex-col gap-1">
            Référence ou téléphone
            <input name="q" defaultValue={filters.q} placeholder="PAY-… ou 06 …" className={`${select} w-48`} />
          </label>
          <button type="submit" className="admin-btn admin-btn-primary h-9">
            Filtrer
          </button>
          {qs.toString() && (
            <Link href="/admin/paiements" className="admin-btn admin-btn-outline h-9">
              Effacer
            </Link>
          )}
        </form>

        <DataTable head={["Date", "Référence", "Objet", "Payeur", "Moyen", "Montant", "État"]}>
          {rows.map((r) => {
            const href = paymentTargetHref(r);
            return (
              <tr key={r.p.id} data-testid="payment-row">
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.p.createdAt)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.p.reference}</td>
                <td className="px-3 py-2">
                  {href ? (
                    <Link href={href} className="underline-offset-2 hover:underline">
                      {PAYMENT_PURPOSE_LABELS[r.p.purpose]}
                    </Link>
                  ) : (
                    PAYMENT_PURPOSE_LABELS[r.p.purpose]
                  )}
                </td>
                <td className="px-3 py-2">
                  {payerLabel(r)}
                  <span className="block text-xs text-muted-foreground">{formatCongoPhone(r.p.phone)}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{PAYMENT_METHOD_LABELS[r.p.method]}</td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap tabular-nums">{formatFcfa(r.p.amount)}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={TONE[r.p.status]}>{PAYMENT_STATUS_LABELS[r.p.status]}</StatusBadge>
                  {r.p.failureReason && <span className="block text-xs text-muted-foreground">{r.p.failureReason}</span>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                Aucun paiement.
              </td>
            </tr>
          )}
        </DataTable>

        <Pager page={page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={pageHref} />

        {pending.n > 0 && (
          <section className="max-w-xl">
            <h2 className="mb-2 font-semibold">Paiements en attente</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Un paiement non validé par le payeur expire au bout de 15 minutes ; les places réservées sont alors remises en vente.
            </p>
            <ActionForm action={expirePendingPayments} label="Expirer les paiements en attente depuis plus de 15 minutes" />
          </section>
        )}
      </div>
    </>
  );
}
