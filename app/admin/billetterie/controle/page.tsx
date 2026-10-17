import type { Metadata } from "next";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ticketEvents, tickets } from "@/lib/db/schema";
import { daysAgo, formatDateTime } from "@/lib/format";
import { scanAtGate, syncOfflineScans } from "../actions";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { GatePanel } from "@/components/admin/gate-panel";
import { gateCounts } from "@/lib/queries/gates";
import { Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Contrôle d'accès — FECOFOOT" };

/** Contrôle des e-billets aux portes du stade (M12). */
export default async function AccessControlPage({ searchParams }: PageProps<"/admin/billetterie/controle">) {
  await requirePermission("ticketing.manage");
  const events = await db
    .select()
    .from(ticketEvents)
    .where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN", "CLOSED"]), gte(ticketEvents.kickoffAt, daysAgo(1))))
    .orderBy(asc(ticketEvents.kickoffAt));
  const raw = (await searchParams).event;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const event = events.find((e) => e.id === requested) ?? events[0];
  const [entries, gates] = event
    ? await Promise.all([db.$count(tickets, and(eq(tickets.eventId, event.id), eq(tickets.status, "USED"))), gateCounts(event.id)])
    : [0, []];

  return (
    <>
      <PageHeader eyebrow="Billetterie" title="Contrôle d'accès" description="Chaque billet n'est accepté qu'une seule fois, même présenté à deux portes en même temps." />
      {!event ? (
        <p className="text-sm text-muted-foreground">Aucun match à contrôler.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <form className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1.5 font-medium">
              Match
              <select name="event" defaultValue={event.id} className="h-10 max-w-full rounded-md border px-2">
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {formatDateTime(e.kickoffAt)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
              Changer
            </button>
          </form>
          <Scanner key={event.id} eventId={event.id} action={scanAtGate.bind(null, event.id)} sync={syncOfflineScans.bind(null, event.id)} initialEntries={entries} />
          <GatePanel gates={gates} />
          <AutoRefresh seconds={20} />
        </div>
      )}
    </>
  );
}
