import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusSelectForm } from "@/app/admin/competitions/CompetitionForms";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ticketEvents } from "@/lib/db/schema";
import { formatDateTime, formatFcfa } from "@/lib/format";
import { eventDashboard } from "@/lib/queries/ticketing-dashboard";
import { ORDER_CHANNEL_LABELS, ORDER_STATUS_LABELS, remaining, SALES_STATUS_LABELS } from "@/lib/ticketing";
import { addCategory, counterSale, refundTicketOrder, setSalesStatus } from "../actions";
import { CategoryForm, CounterForm } from "../TicketingForms";

export const metadata: Metadata = { title: "Événement — billetterie FECOFOOT" };

export default async function AdminTicketEventPage({ params }: PageProps<"/admin/billetterie/[id]">) {
  await requirePermission("ticketing.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [event] = await db.select().from(ticketEvents).where(eq(ticketEvents.id, id)).limit(1);
  if (!event) notFound();
  const d = await eventDashboard(id);
  const capacity = d.categories.reduce((a, c) => a + c.capacity, 0);
  const sold = d.categories.reduce((a, c) => a + c.sold, 0);
  const revenue = d.byChannel.reduce((a, c) => a + c.revenue, 0);

  return (
    <>
      <PageHeader
        eyebrow={`Billetterie · ${SALES_STATUS_LABELS[event.salesStatus]}`}
        title={event.title}
        description={`${formatDateTime(event.kickoffAt)} · ${event.venue} · ${event.maxTicketsPerFan} billets max. par Fan ID · ${event.attendancePoints} point(s) de fidélité`}
        actions={
          <>
            <Link href={`/billetterie/${event.slug}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Page publique
            </Link>
            <Link href={`/admin/billetterie/controle?event=${event.id}`} className="admin-btn admin-btn-primary">
              Contrôle d&apos;accès
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-10">
        {/* Tableau de bord (EF-BIL-10) */}
        <StatCards
          testIdPrefix="kpi-"
          stats={[
            { label: "Billets vendus", value: `${sold} / ${capacity}`, sub: capacity ? `${Math.round((sold / capacity) * 100)} % de la jauge` : undefined },
            { label: "Recettes", value: formatFcfa(revenue) },
            { label: "Entrées contrôlées", value: String(d.entries) },
            { label: "Contrôles refusés", value: String(d.refused) },
          ]}
        />

        <section id="modifier" className="flex flex-col gap-3">
          <h2 className="font-semibold">Tribunes</h2>
          <DataTable head={["Tribune", "Porte", "Prix public / membre", "Vendus", "Réservés", "Disponibles", "Remplissage"]}>
            {d.categories.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2">{c.gate}</td>
                <td className="px-3 py-2">
                  {formatFcfa(c.publicPrice)} / {formatFcfa(c.memberPrice)}
                </td>
                <td className="px-3 py-2">{c.sold}</td>
                <td className="px-3 py-2">{c.reserved}</td>
                <td className="px-3 py-2">{remaining(c.capacity, c.sold + c.reserved)}</td>
                <td className="px-3 py-2">{Math.round((100 * c.sold) / c.capacity)} %</td>
              </tr>
            ))}
          </DataTable>
          <CategoryForm action={addCategory.bind(null, id)} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <StatusSelectForm action={setSalesStatus.bind(null, id)} current={event.salesStatus} options={SALES_STATUS_LABELS} label="Statut de la vente" />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Recettes par canal</h2>
          <ul className="flex flex-wrap gap-3 text-sm">
            {d.byChannel.map((c) => (
              <li key={c.channel} className="rounded-lg border px-3 py-2">
                {ORDER_CHANNEL_LABELS[c.channel]} : <strong>{formatFcfa(c.revenue)}</strong> ({c.orders} commande(s))
              </li>
            ))}
            {d.byChannel.length === 0 && <li className="text-muted-foreground">Aucune vente.</li>}
          </ul>
        </section>

        {d.categories.length > 0 && (
          <section className="flex flex-col gap-3 border-t pt-6">
            <h2 className="font-semibold">Guichet et invitations</h2>
            <CounterForm action={counterSale.bind(null, id)} categories={d.categories.map((c) => ({ id: c.id, label: `${c.name} — ${formatFcfa(c.publicPrice)}` }))} />
          </section>
        )}

        {/* Clôture de caisse (EF-BIL-12) */}
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Clôture de caisse (guichet)</h2>
          {d.cash.length === 0 ? (
            <EmptyState icon="ticket" title="Aucune vente au guichet" compact />
          ) : (
            <DataTable head={["Jour", "Agent", "Commandes", "Montant encaissé"]}>
              {d.cash.map((c) => (
                <tr key={`${c.day}-${c.agent}`}>
                  <td className="px-3 py-2">{c.day}</td>
                  <td className="px-3 py-2">{c.agent}</td>
                  <td className="px-3 py-2">{c.orders}</td>
                  <td className="px-3 py-2 font-semibold">{formatFcfa(c.amount)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Commandes</h2>
          <DataTable head={["Référence", "Fan ID", "Canal", "Montant", "Statut", ""]}>
            {d.orders.map(({ order: o, fanId, name }) => (
              <tr key={o.id}>
                <td className="px-3 py-2 font-mono text-xs">{o.reference}</td>
                <td className="px-3 py-2">
                  {name} <span className="text-xs text-muted-foreground">{fanId}</span>
                </td>
                <td className="px-3 py-2">{ORDER_CHANNEL_LABELS[o.channel]}</td>
                <td className="px-3 py-2">{formatFcfa(o.total)}</td>
                <td className="px-3 py-2">{ORDER_STATUS_LABELS[o.status]}</td>
                <td className="px-3 py-2">{o.status === "PAID" && <ActionForm action={refundTicketOrder.bind(null, id, o.id)} label="Rembourser" variant="outline" />}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      </div>
    </>
  );
}
