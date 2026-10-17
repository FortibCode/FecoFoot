import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PaymentButtons } from "@/app/paiement/[reference]/PaymentButtons";
import { PageHeader } from "@/components/admin/page-header";
import { requireAnyPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { formatFcfa } from "@/lib/format";
import { paymentMode } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments-rules";
import { loadLicenseFor } from "@/lib/queries/players";
import { formatCongoPhone } from "@/lib/supporters";
import { answerLicensePayment } from "../../../payment-actions";

export const metadata: Metadata = { title: "Paiement des droits de licence — FECOFOOT" };

export default async function LicensePaymentPage({ params }: PageProps<"/admin/licences/[id]/paiement/[reference]">) {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const { id: rawId, reference } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const row = await loadLicenseFor(user, id);
  const [p] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!row || !p || p.purpose !== "LICENSE_FEE" || p.targetId !== id || p.userId !== user.id) notFound();

  return (
    <>
      <PageHeader eyebrow={`Licence ${row.license.number}`} title={`Droits de licence : ${formatFcfa(p.amount)}`} />
      <div className="flex max-w-xl flex-col gap-6 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-muted-foreground">Référence</dt><dd className="font-mono">{p.reference}</dd></div>
          <div><dt className="text-muted-foreground">Moyen</dt><dd>{PAYMENT_METHOD_LABELS[p.method]}</dd></div>
          <div><dt className="text-muted-foreground">Téléphone</dt><dd>{formatCongoPhone(p.phone)}</dd></div>
          <div><dt className="text-muted-foreground">État</dt><dd>{PAYMENT_STATUS_LABELS[p.status]}</dd></div>
        </dl>
        {p.status !== "PENDING" ? (
          <Link href={`/admin/licences/${id}`} className="w-fit underline">Retour à la licence</Link>
        ) : paymentMode() === "simulation" ? (
          <>
            <p className="rounded-md bg-[color-mix(in_oklch,var(--flag-yellow)_30%,transparent)] px-3 py-2">
              Mode démonstration : aucun montant n&apos;est débité. En production, le payeur valide sur son téléphone.
            </p>
            <PaymentButtons accept={answerLicensePayment.bind(null, id, p.reference, true)} refuse={answerLicensePayment.bind(null, id, p.reference, false)} />
          </>
        ) : (
          <p>Validez le paiement sur le téléphone avec le code secret {PAYMENT_METHOD_LABELS[p.method]}, puis actualisez cette page.</p>
        )}
      </div>
    </>
  );
}
