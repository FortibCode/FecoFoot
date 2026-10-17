import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { answerSimulatedPayment } from "@/app/supporters/actions";
import { requireSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { formatFcfa } from "@/lib/format";
import { paymentMode } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payments-rules";
import { formatCongoPhone } from "@/lib/supporters";
import { PaymentButtons } from "./PaymentButtons";

export const metadata: Metadata = { title: "Paiement Mobile Money — FECOFOOT", robots: { index: false } };

/**
 * Paiement Mobile Money. En production, le payeur valide sur son téléphone (code secret Mobile Money)
 * et l'opérateur prévient la plateforme ; en simulation, il valide ici.
 */
export default async function PaymentPage({ params }: PageProps<"/paiement/[reference]">) {
  const s = await requireSupporter();
  const { reference } = await params;
  const [p] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p || p.supporterId !== s.id) notFound();
  const simulation = paymentMode() === "simulation";

  return (
    <PublicShell eyebrow="Paiement" title={formatFcfa(p.amount)}>
      <div className="flex flex-col gap-6 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-muted-foreground">Référence</dt><dd className="font-mono">{p.reference}</dd></div>
          <div><dt className="text-muted-foreground">Moyen</dt><dd>{PAYMENT_METHOD_LABELS[p.method]}</dd></div>
          <div><dt className="text-muted-foreground">Téléphone</dt><dd>{formatCongoPhone(p.phone)}</dd></div>
          <div><dt className="text-muted-foreground">État</dt><dd>{PAYMENT_STATUS_LABELS[p.status]}</dd></div>
        </dl>
        {p.status !== "PENDING" ? (
          <Link href="/supporters/espace" className="w-fit underline">
            Retour à mon espace
          </Link>
        ) : simulation ? (
          <>
            <p className="rounded-md bg-[color-mix(in_oklch,var(--flag-yellow)_30%,transparent)] px-3 py-2">
              Mode démonstration : aucun montant n&apos;est débité. En production, vous valideriez ce paiement sur votre téléphone.
            </p>
            <PaymentButtons accept={answerSimulatedPayment.bind(null, p.reference, true)} refuse={answerSimulatedPayment.bind(null, p.reference, false)} />
          </>
        ) : (
          <p>Validez le paiement sur votre téléphone avec votre code secret {PAYMENT_METHOD_LABELS[p.method]}, puis actualisez cette page.</p>
        )}
      </div>
    </PublicShell>
  );
}
