"use server";

import { and, desc, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { confirmPayment, failPayment, PAYMENT_TTL_MS, paymentMode, startPayment } from "@/lib/payments";
import { methodForOperator } from "@/lib/payments-rules";
import { loadLicenseFor } from "@/lib/queries/players";
import { normalizeCongoPhone, operatorOf } from "@/lib/supporters";

/** Paiement des droits de licence par Mobile Money depuis l'espace fédéral (EF-LIC-11). */
export async function payLicenseFee(licenseId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const row = await loadLicenseFor(user, licenseId);
  if (!row) return { error: "Licence introuvable." };
  const { license } = row;
  if (license.status !== "PENDING") return { error: "Les droits de cette licence ne sont plus à payer." };
  if (license.feeAmount <= 0) return { error: "Aucun droit à payer pour cette licence." };

  const phone = normalizeCongoPhone(String(formData.get("phone") ?? ""));
  const method = phone ? methodForOperator(operatorOf(phone)) : null;
  if (!phone || !method) return { error: "Indiquez un numéro Airtel Money (05) ou MTN MoMo (06)." };

  // Un paiement déjà en cours pour cette licence est repris plutôt que dupliqué.
  const [pending] = await db
    .select({ reference: payments.reference })
    .from(payments)
    .where(
      and(
        eq(payments.purpose, "LICENSE_FEE"),
        eq(payments.targetId, licenseId),
        eq(payments.status, "PENDING"),
        eq(payments.userId, user.id),
        gt(payments.createdAt, new Date(Date.now() - PAYMENT_TTL_MS)),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  let reference = pending?.reference;
  if (!reference) {
    try {
      ({ reference } = await startPayment({ purpose: "LICENSE_FEE", targetId: licenseId, amount: license.feeAmount, method, phone, supporterId: null, userId: user.id }));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Paiement impossible." };
    }
    await logAudit({ userId: user.id, action: "LICENSE_PAYMENT_STARTED", entity: "license", entityId: licenseId, details: { reference, method } });
  }
  redirect(`/admin/licences/${licenseId}/paiement/${reference}`);
}

/** Confirmation ou refus en mode simulation (en production, le payeur valide sur son téléphone). */
export async function answerLicensePayment(licenseId: number, reference: string, accept: boolean): Promise<ActionState> {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const [p] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p || p.purpose !== "LICENSE_FEE" || p.targetId !== licenseId || p.userId !== user.id) return { error: "Paiement introuvable." };
  if (paymentMode() !== "simulation") return { error: "La confirmation se fait sur le téléphone du payeur." };
  if (!accept) {
    await failPayment(reference, "Refusé par le payeur");
    return { error: "Paiement refusé." };
  }
  let result: Awaited<ReturnType<typeof confirmPayment>>;
  try {
    result = await confirmPayment(reference);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Confirmation impossible." };
  }
  if (result === "expired") return { error: "Le délai de 15 minutes est dépassé : recommencez." };
  if (result === "not_pending") return { error: "Ce paiement a déjà été traité." };
  await logAudit({ userId: user.id, action: "LICENSE_PAID_MOBILE_MONEY", entity: "license", entityId: licenseId, details: { reference, simulated: true } });
  revalidatePath(`/admin/licences/${licenseId}`);
  revalidatePath("/admin/licences");
  redirect(`/admin/licences/${licenseId}`);
}
