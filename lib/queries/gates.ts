import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ticketCategories, ticketEvents, tickets } from "@/lib/db/schema";
import { GATE_FLOW_WINDOW_MINUTES, gateKey, gateLoad } from "@/lib/ticketing";

/**
 * Comptage par porte (EF-CTL-07) : entrées enregistrées à chaque porte (dont celles synchronisées après
 * une coupure), débit récent, billets attendus et capacité des tribunes desservies.
 */
export async function gateCounts(eventId: number, now: Date = new Date()) {
  const since = new Date(now.getTime() - GATE_FLOW_WINDOW_MINUTES * 60_000);
  const [[event], cats, scans] = await Promise.all([
    db.select({ flowLimit: ticketEvents.gateFlowLimit }).from(ticketEvents).where(eq(ticketEvents.id, eventId)).limit(1),
    db
      .select({
        gate: ticketCategories.gate,
        capacity: ticketCategories.capacity,
        expected: sql<number>`(select count(*)::int from ${tickets} where ${tickets.categoryId} = ${ticketCategories.id} and ${tickets.status} in ('VALID', 'USED'))`,
      })
      .from(ticketCategories)
      .where(eq(ticketCategories.eventId, eventId)),
    db
      .select({
        gate: tickets.usedGate,
        entries: sql<number>`count(*)::int`,
        recent: sql<number>`(count(*) filter (where ${tickets.usedAt} >= ${since.toISOString()}))::int`,
      })
      .from(tickets)
      .where(and(eq(tickets.eventId, eventId), inArray(tickets.status, ["USED"])))
      .groupBy(tickets.usedGate),
  ]);
  if (!event) return [];

  const gates = new Map<string, { gate: string; capacity: number; expected: number; entries: number; recentEntries: number }>();
  const slot = (name: string) => {
    const key = gateKey(name);
    let g = gates.get(key);
    if (!g) gates.set(key, (g = { gate: name.trim(), capacity: 0, expected: 0, entries: 0, recentEntries: 0 }));
    return g;
  };
  for (const c of cats) {
    const g = slot(c.gate);
    g.capacity += c.capacity;
    g.expected += c.expected;
  }
  for (const s of scans) {
    const g = slot(s.gate ?? "—");
    g.entries += s.entries;
    g.recentEntries += s.recent;
  }
  return [...gates.values()]
    .map((g) => ({ ...g, ...gateLoad({ ...g, flowLimit: event.flowLimit }), flowLimit: event.flowLimit }))
    .sort((a, b) => a.gate.localeCompare(b.gate, "fr"));
}
