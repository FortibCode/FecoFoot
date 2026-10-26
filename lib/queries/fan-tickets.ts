import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ticketCategories, ticketEvents, ticketOrders, tickets } from "@/lib/db/schema";

/** Billets d'un supporter (commandes payées ou en attente), du prochain match au plus lointain. */
export async function supporterTickets(supporterId: number, token?: string) {
  return db
    .select({
      id: tickets.id,
      number: tickets.number,
      token: tickets.token,
      holderName: tickets.holderName,
      price: tickets.price,
      status: tickets.status,
      category: ticketCategories.name,
      gate: ticketCategories.gate,
      eventId: ticketEvents.id,
      event: ticketEvents.title,
      kind: ticketEvents.kind,
      orderRef: ticketOrders.reference,
      kickoffAt: ticketEvents.kickoffAt,
      venue: ticketEvents.venue,
    })
    .from(tickets)
    .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
    .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .innerJoin(ticketEvents, eq(tickets.eventId, ticketEvents.id))
    .where(and(eq(ticketOrders.supporterId, supporterId), inArray(tickets.status, ["RESERVED", "VALID", "USED"]), token ? eq(tickets.token, token) : undefined))
    .orderBy(asc(ticketEvents.kickoffAt), asc(tickets.number));
}
