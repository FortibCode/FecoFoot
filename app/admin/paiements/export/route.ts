import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { download, workbook, XLSX_TYPE } from "@/lib/exports/xlsx";
import { PAYMENT_METHOD_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments-rules";
import { exportPayments, payerLabel, paymentFilters } from "@/lib/queries/payments";

const MAX = 50_000;

/** Export Excel des paiements, avec les filtres de la page (M16). */
export async function GET(request: Request) {
  const user = await requirePermission("payments.manage");
  const sp = new URL(request.url).searchParams;
  const filters = paymentFilters((k) => sp.get(k));
  const rows = await exportPayments(filters, MAX);
  await logAudit({ userId: user.id, action: "PAYMENTS_EXPORTED", entity: "payment", details: { ...filters, rows: rows.length } });
  const bytes = await workbook(
    "Paiements",
    [
      { header: "Date (UTC)", width: 20 },
      { header: "Référence", width: 20 },
      { header: "Objet", width: 20 },
      { header: "Payeur", width: 30 },
      { header: "Téléphone", width: 16 },
      { header: "Moyen", width: 16 },
      { header: "Montant (FCFA)", width: 16 },
      { header: "État", width: 26 },
      { header: "Confirmé le (UTC)", width: 20 },
      { header: "Réf. opérateur", width: 22 },
      { header: "Motif d'échec", width: 30 },
    ],
    rows.map((r) => [
      r.p.createdAt,
      r.p.reference,
      PAYMENT_PURPOSE_LABELS[r.p.purpose],
      payerLabel(r),
      r.p.phone,
      PAYMENT_METHOD_LABELS[r.p.method],
      r.p.amount,
      PAYMENT_STATUS_LABELS[r.p.status],
      r.p.confirmedAt,
      r.p.providerRef ?? "",
      r.p.failureReason ?? "",
    ]),
  );
  return download(bytes, `paiements-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX_TYPE);
}
