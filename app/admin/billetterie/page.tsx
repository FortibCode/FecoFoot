import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { deleteTicketEvent } from "./actions";
import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ticketEvents, ticketOrders } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { EVENT_KIND_LABELS, EVENT_KINDS, SALES_STATUS_LABELS, SALES_STATUSES } from "@/lib/ticketing";
import { StatCards } from "@/components/admin/stat-cards";
import { SelectField } from "@/components/ui/field";
import { textMatch } from "@/lib/text-search";
import { createTicketEvent } from "./actions";
import { EventForm } from "./TicketingForms";

export const metadata: Metadata = { title: "Billetterie — FECOFOOT" };

export default async function AdminTicketingPage({ searchParams }: PageProps<"/admin/billetterie">) {
  await requirePermission("ticketing.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const sales = SALES_STATUSES.find((s) => s === sp.sales);
  const kind = EVENT_KINDS.find((k) => k === sp.kind);
  const [all, [sold]] = await Promise.all([
    db.select().from(ticketEvents).orderBy(desc(ticketEvents.kickoffAt)).limit(500),
    db
      .select({
        orders: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${ticketOrders.total}), 0)::int`,
      })
      .from(ticketOrders)
      .where(and(eq(ticketOrders.status, "PAID"), gte(ticketOrders.paidAt, sql`now() - interval '30 days'`))),
  ]);
  const events = all.filter((e) => textMatch(q, e.title, e.venue) && (!sales || e.salesStatus === sales) && (!kind || e.kind === kind));
  return (
    <>
      <PageHeader
        eyebrow="Stade & supporters"
        title="Billetterie"
        actions={
          <Link href="/admin/billetterie/controle" className="admin-btn admin-btn-primary">
            Contrôle d&apos;accès
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: "Événements", value: all.length },
          { label: "En vente", value: all.filter((e) => e.salesStatus === "OPEN" || e.salesStatus === "PRESALE").length, href: "/admin/billetterie?sales=OPEN", active: sales === "OPEN" },
          { label: "Commandes payées (30 j)", value: sold.orders },
          { label: "Encaissé (30 j)", value: `${new Intl.NumberFormat("fr-FR").format(sold.revenue)} FCFA` },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Événement ou stade" className="admin-input" style={{ maxWidth: 220 }} />
        </label>
        <SelectField label="Vente" name="sales" defaultValue={sales ?? ""}>
          <option value="">Toutes</option>
          {SALES_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SALES_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Type" name="kind" defaultValue={kind ?? ""}>
          <option value="">Tous</option>
          {EVENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {EVENT_KIND_LABELS[k]}
            </option>
          ))}
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["Événement", "Date", "Stade", "Vente", ""]} pageSize={5}>
        {events.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Aucun événement ne correspond.
            </td>
          </tr>
        )}
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
            <td>
              <RowActions name={e.title} viewHref={`/admin/billetterie/${e.id}`} editHref={`/admin/billetterie/${e.id}#modifier`} onDelete={deleteTicketEvent.bind(null, e.id)} />
            </td>
          </tr>
        ))}
      </DataTable>
      <section className="mt-6 flex flex-col gap-3">
        <h2 className="font-semibold">Nouvel événement</h2>
        <EventForm action={createTicketEvent} />
      </section>
    </>
  );
}
