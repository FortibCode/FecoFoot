import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { fulfil } from "@/lib/payment-fulfilment";
import { sendTicketConfirmation } from "@/lib/ticket-confirmation";
import { paymentReference, type PaymentMethod, type PaymentPurpose } from "@/lib/payments-rules";

/**
 * Passerelle Mobile Money (M16).
 *
 * PAYMENT_MODE=simulation (défaut) : aucun débit réel ; le payeur confirme ou refuse sur une page
 * de simulation — développement, démonstrations et recette.
 * PAYMENT_MODE=live : brancher ici les API Airtel Money et MTN MoMo (paiement « push » vers le
 * téléphone, puis rappel serveur de l'opérateur appelant confirmPayment / failPayment), une fois
 * les contrats marchands signés (§9). Le reste de l'application ne change pas.
 */
export const paymentMode = () => (process.env.PAYMENT_MODE === "live" ? "live" : "simulation");

/** Un paiement non confirmé expire au bout de 15 minutes (RG-11 pour la billetterie). */
export const PAYMENT_TTL_MS = 15 * 60 * 1000;

export async function startPayment(p: {
  purpose: PaymentPurpose;
  targetId: number;
  amount: number;
  method: PaymentMethod;
  phone: string;
  supporterId: number | null;
  userId?: number | null;
}): Promise<{ reference: string }> {
  const reference = paymentReference(p.purpose, randomBytes(5).toString("hex").slice(0, 8));
  if (paymentMode() === "live" && p.method !== "CASH") {
    // TODO (mise en production) : demande de paiement « push » à l'opérateur ; providerRef = identifiant opérateur.
    throw new Error(`Passerelle ${p.method} non configurée (PAYMENT_MODE=live).`);
  }
  await db.insert(payments).values({ ...p, reference, providerRef: paymentMode() === "simulation" ? `SIM-${reference}` : null });
  return { reference };
}

/**
 * Confirmation (simulation, ou rappel de l'opérateur en production) : passage à « payé » et
 * exécution de la commande dans la même transaction — tout ou rien, et une seule fois.
 */
export async function confirmPayment(reference: string): Promise<"ok" | "not_pending" | "expired"> {
  const outcome = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.reference, reference)).for("update").limit(1);
    if (!p || p.status !== "PENDING") return { result: "not_pending" as const };
    if (Date.now() - p.createdAt.getTime() > PAYMENT_TTL_MS) {
      await tx.update(payments).set({ status: "EXPIRED" }).where(eq(payments.id, p.id));
      return { result: "expired" as const };
    }
    await tx.update(payments).set({ status: "SUCCEEDED", confirmedAt: new Date() }).where(eq(payments.id, p.id));
    await fulfil(tx, p.purpose, p.targetId);
    return { result: "ok" as const, purpose: p.purpose, targetId: p.targetId };
  });
  // Après validation : l'acheteur reçoit ses billets par SMS / e-mail (un échec d'envoi n'annule rien).
  if (outcome.result === "ok" && outcome.purpose === "TICKET_ORDER") await sendTicketConfirmation(outcome.targetId).catch(() => undefined);
  return outcome.result;
}

export async function failPayment(reference: string, reason: string): Promise<void> {
  await db
    .update(payments)
    .set({ status: "FAILED", failureReason: reason })
    .where(and(eq(payments.reference, reference), eq(payments.status, "PENDING")));
}

/** Expire les paiements en attente depuis plus de 15 minutes. */
export async function expireStalePayments(): Promise<void> {
  await db
    .update(payments)
    .set({ status: "EXPIRED" })
    .where(and(eq(payments.status, "PENDING"), lt(payments.createdAt, new Date(Date.now() - PAYMENT_TTL_MS))));
}
