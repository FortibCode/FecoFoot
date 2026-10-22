"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { startPayment } from "@/lib/payments";
import { PAYMENT_METHODS } from "@/lib/payments-rules";
import { createOrder, markOrderPaid } from "@/lib/ticket-sales";
import { sendTicketConfirmation } from "@/lib/ticket-confirmation";

/** Achat en ligne de billets nominatifs, payés par Mobile Money (EF-BIL-04 à 07). */
export async function buyTickets(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireSupporter();
  const categoryId = Number(formData.get("categoryId"));
  const quantity = Number(formData.get("quantity"));
  const method = z.enum(PAYMENT_METHODS).exclude(["CASH"]).safeParse(formData.get("method"));
  if (!Number.isInteger(categoryId) || categoryId <= 0) return { error: "Choisissez une tribune." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return { error: "Nombre de billets invalide." };
  if (!method.success) return { error: "Choisissez Airtel Money ou MTN MoMo." };
  if (!s.photoKey) return { error: "Ajoutez votre photo d'identité dans votre espace supporter avant votre premier achat." };
  const extraHolders = Array.from({ length: quantity - 1 }, (_, i) => String(formData.get(`holder_${i + 1}`) ?? ""));

  const order = await createOrder({ eventId, categoryId, supporterId: s.id, extraHolders, channel: "ONLINE", soldBy: null });
  if ("error" in order) return { error: order.error };
  if (order.total === 0) {
    // Billets gratuits : pas de paiement à attendre.
    await db.transaction((tx) => markOrderPaid(tx, order.orderId));
    await sendTicketConfirmation(order.orderId).catch(() => undefined);
    redirect("/supporters/espace?achat=ok");
  }
  const { reference } = await startPayment({ purpose: "TICKET_ORDER", targetId: order.orderId, amount: order.total, method: method.data, phone: s.phone, supporterId: s.id });
  redirect(`/paiement/${reference}`);
}
