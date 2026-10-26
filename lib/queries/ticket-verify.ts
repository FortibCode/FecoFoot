import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, ticketCategories, ticketEvents, ticketOrders, tickets } from "@/lib/db/schema";

/**
 * Vérification publique d'un billet par le jeton de son QR code (scan au téléphone par un steward,
 * un contrôleur ou le porteur) : authenticité, paiement, état. Lecture seule : le billet n'est jamais
 * marqué « utilisé » ici (le contrôle d'accès se fait dans l'administration, porte par porte).
 */
export async function verifyTicket(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [t] = await db
    .select({
      number: tickets.number,
      holderName: tickets.holderName,
      price: tickets.price,
      status: tickets.status,
      usedAt: tickets.usedAt,
      usedGate: tickets.usedGate,
      category: ticketCategories.name,
      gate: ticketCategories.gate,
      event: ticketEvents.title,
      kickoffAt: ticketEvents.kickoffAt,
      venue: ticketEvents.venue,
      orderId: ticketOrders.id,
      orderRef: ticketOrders.reference,
      orderStatus: ticketOrders.status,
      channel: ticketOrders.channel,
      paidAt: ticketOrders.paidAt,
    })
    .from(tickets)
    .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
    .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .innerJoin(ticketEvents, eq(tickets.eventId, ticketEvents.id))
    .where(eq(tickets.token, token))
    .limit(1);
  if (!t) return null;
  const [payment] = await db
    .select({ method: payments.method, reference: payments.reference, amount: payments.amount, confirmedAt: payments.confirmedAt })
    .from(payments)
    .where(and(eq(payments.purpose, "TICKET_ORDER"), eq(payments.targetId, t.orderId), eq(payments.status, "SUCCEEDED")))
    .orderBy(desc(payments.confirmedAt))
    .limit(1);
  return { ...t, payment: payment ?? null };
}

export type VerifiedTicket = NonNullable<Awaited<ReturnType<typeof verifyTicket>>>;
