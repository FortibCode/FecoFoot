import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { scanRefusals, supporters, ticketCategories, ticketOrders, tickets, users } from "@/lib/db/schema";

/** Tableau de bord d'un événement (EF-BIL-10) et clôture de caisse (EF-BIL-12). */
export async function eventDashboard(eventId: number) {
  const [categories, byCategory, byChannel, [{ entries }], [{ refused }], cash, orders] = await Promise.all([
    db.select().from(ticketCategories).where(eq(ticketCategories.eventId, eventId)).orderBy(asc(ticketCategories.sortOrder), asc(ticketCategories.id)),
    db
      .select({
        categoryId: tickets.categoryId,
        sold: sql<number>`count(*) filter (where ${tickets.status} in ('VALID', 'USED'))::int`,
        reserved: sql<number>`count(*) filter (where ${tickets.status} = 'RESERVED')::int`,
        used: sql<number>`count(*) filter (where ${tickets.status} = 'USED')::int`,
      })
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .groupBy(tickets.categoryId),
    db
      .select({ channel: ticketOrders.channel, orders: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${ticketOrders.total}), 0)::int` })
      .from(ticketOrders)
      .where(and(eq(ticketOrders.eventId, eventId), eq(ticketOrders.status, "PAID")))
      .groupBy(ticketOrders.channel),
    db.select({ entries: sql<number>`count(*)::int` }).from(tickets).where(and(eq(tickets.eventId, eventId), eq(tickets.status, "USED"))),
    db.select({ refused: sql<number>`count(*)::int` }).from(scanRefusals).where(eq(scanRefusals.eventId, eventId)),
    db
      .select({
        agent: users.fullName,
        day: sql<string>`to_char(${ticketOrders.paidAt} at time zone 'Africa/Brazzaville', 'DD/MM/YYYY')`,
        orders: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${ticketOrders.total}), 0)::int`,
      })
      .from(ticketOrders)
      .innerJoin(users, eq(ticketOrders.soldBy, users.id))
      .where(and(eq(ticketOrders.eventId, eventId), eq(ticketOrders.channel, "COUNTER"), eq(ticketOrders.status, "PAID")))
      .groupBy(users.fullName, sql`2`)
      .orderBy(sql`2`, users.fullName),
    db
      .select({ order: ticketOrders, fanId: supporters.fanId, name: sql<string>`${supporters.firstName} || ' ' || ${supporters.lastName}` })
      .from(ticketOrders)
      .innerJoin(supporters, eq(ticketOrders.supporterId, supporters.id))
      .where(eq(ticketOrders.eventId, eventId))
      .orderBy(desc(ticketOrders.createdAt))
      .limit(100),
  ]);
  const stats = new Map(byCategory.map((r) => [r.categoryId, r]));
  return {
    categories: categories.map((c) => ({ ...c, sold: stats.get(c.id)?.sold ?? 0, reserved: stats.get(c.id)?.reserved ?? 0, used: stats.get(c.id)?.used ?? 0 })),
    byChannel,
    entries,
    refused,
    cash,
    orders,
  };
}
