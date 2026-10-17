import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ticketEvents } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { EVENT_KIND_LABELS, SALES_STATUS_LABELS } from "@/lib/ticketing";
import { createTicketEvent } from "./actions";
import { EventForm } from "./TicketingForms";

export const metadata: Metadata = { title: "Billetterie — FECOFOOT" };

export default async function AdminTicketingPage() {
  await requirePermission("ticketing.manage");
  const events = await db.select().from(ticketEvents).orderBy(desc(ticketEvents.kickoffAt)).limit(100);
  return (
    <>
      <PageHeader
        eyebrow="Stade & supporters"
        title="Billetterie"
        actions={
          <Link href="/admin/billetterie/controle" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Contrôle d&apos;accès
          </Link>
        }
      />
      <DataTable head={["Événement", "Date", "Stade", "Vente"]}>
        {events.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/billetterie/${e.id}`} className="font-medium underline-offset-2 hover:underline">
                {e.title}
              </Link>
              <p className="text-xs text-muted-foreground">{EVENT_KIND_LABELS[e.kind]}</p>
            </td>
            <td className="px-3 py-2">{formatDateTime(e.kickoffAt)}</td>
            <td className="px-3 py-2">{e.venue}</td>
            <td className="px-3 py-2">{SALES_STATUS_LABELS[e.salesStatus]}</td>
          </tr>
        ))}
      </DataTable>
      <h2 className="mt-8 mb-3 font-semibold">Nouvel événement</h2>
      <EventForm action={createTicketEvent} />
    </>
  );
}
