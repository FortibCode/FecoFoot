"use server";

import { and, count, eq, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { expireStalePayments, PAYMENT_TTL_MS } from "@/lib/payments";
import { expireStaleOrders } from "@/lib/ticket-sales";

/** Passe à « expiré » les paiements restés en attente plus de 15 minutes (payeur qui n'a jamais validé). */
export async function expirePendingPayments(): Promise<ActionState> {
  const user = await requirePermission("payments.manage");
  const stale = and(eq(payments.status, "PENDING"), lt(payments.createdAt, new Date(Date.now() - PAYMENT_TTL_MS)));
  const [{ n }] = await db.select({ n: count() }).from(payments).where(stale);
  await expireStalePayments();
  // Commandes de billets non payées : places remises en vente.
  await expireStaleOrders();
  await logAudit({ userId: user.id, action: "PAYMENTS_EXPIRED", entity: "payment", details: { count: n } });
  revalidatePath("/admin/paiements");
  return { success: n ? `${n} paiement(s) en attente passé(s) à « expiré ».` : "Aucun paiement en attente depuis plus de 15 minutes." };
}
