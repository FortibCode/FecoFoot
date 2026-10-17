import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { db } from "@/lib/db";
import { licenses, memberships, payments, supporterPoints } from "@/lib/db/schema";
import type { PaymentPurpose } from "@/lib/payments-rules";
import { POINTS_PER_MEMBERSHIP } from "@/lib/supporters";
import { markOrderPaid } from "@/lib/ticket-sales";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Adhésion payée : activation et 1 point de fidélité (EF-SUP-03, RG-15). */
async function activateMembership(tx: Tx, membershipId: number) {
  const [m] = await tx
    .update(memberships)
    .set({ status: "ACTIVE", activatedAt: new Date() })
    .where(eq(memberships.id, membershipId))
    .returning({ supporterId: memberships.supporterId });
  if (!m) throw new Error(`Adhésion ${membershipId} introuvable.`);
  await tx
    .insert(supporterPoints)
    .values({ supporterId: m.supporterId, points: POINTS_PER_MEMBERSHIP, reason: "MEMBERSHIP", refId: membershipId })
    .onConflictDoNothing();
}

/**
 * Droits de licence payés par Mobile Money (EF-LIC-11) : rapprochement automatique,
 * la licence passe à « droits encaissés » avec la référence du paiement.
 */
async function markLicensePaid(tx: Tx, licenseId: number) {
  const [p] = await tx
    .select({ reference: payments.reference })
    .from(payments)
    .where(and(eq(payments.purpose, "LICENSE_FEE"), eq(payments.targetId, licenseId), eq(payments.status, "SUCCEEDED")))
    .orderBy(desc(payments.confirmedAt))
    .limit(1);
  const updated = await tx
    .update(licenses)
    .set({ status: "PAID", paidAt: new Date(), paymentRef: p?.reference ?? null, updatedAt: new Date() })
    .where(and(eq(licenses.id, licenseId), eq(licenses.status, "PENDING")))
    .returning({ id: licenses.id });
  if (updated.length === 0) throw new Error("La licence n'est plus en attente de paiement.");
}

/** Ce qui se passe quand un paiement est confirmé, selon son objet. Exécuté dans la transaction du paiement. */
export async function fulfil(tx: Tx, purpose: PaymentPurpose, targetId: number): Promise<void> {
  switch (purpose) {
    case "MEMBERSHIP":
      return activateMembership(tx, targetId);
    case "TICKET_ORDER":
      return markOrderPaid(tx, targetId);
    case "LICENSE_FEE":
      return markLicensePaid(tx, targetId);
  }
}
