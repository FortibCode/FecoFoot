import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { ticketCategories, ticketEvents } from "@/lib/db/schema";
import { formatDateTime, formatFcfa } from "@/lib/format";
import { methodForOperator } from "@/lib/payments-rules";
import { operatorOf } from "@/lib/supporters";
import { isActiveMember, takenByCategory } from "@/lib/ticket-sales";
import { purchaseError, remaining, SALES_STATUS_LABELS, unitPrice } from "@/lib/ticketing";
import { buyTickets } from "../actions";
import { BuyForm } from "../BuyForm";

async function load(slug: string) {
  const [e] = await db.select().from(ticketEvents).where(and(eq(ticketEvents.slug, slug), ne(ticketEvents.salesStatus, "DRAFT"))).limit(1);
  return e ?? null;
}

export async function generateMetadata({ params }: PageProps<"/billetterie/[slug]">): Promise<Metadata> {
  const e = await load((await params).slug);
  return e ? { title: `${e.title} — billetterie FECOFOOT`, description: `${formatDateTime(e.kickoffAt)} · ${e.venue}` } : {};
}

/** Page d'un match en vente : tribunes, jauges, tarifs, achat (EF-BIL-02, EF-BIL-04). */
export default async function TicketEventPage({ params }: PageProps<"/billetterie/[slug]">) {
  const event = await load((await params).slug);
  if (!event) notFound();
  const [categories, taken, fan] = await Promise.all([
    db.select().from(ticketCategories).where(eq(ticketCategories.eventId, event.id)).orderBy(asc(ticketCategories.sortOrder), asc(ticketCategories.id)),
    takenByCategory(event.id),
    getCurrentSupporter(),
  ]);
  const member = fan ? await isActiveMember(fan.id) : false;
  const refusal = fan ? purchaseError({ status: event.salesStatus, isMember: member, banned: fan.banned, kickoffAt: event.kickoffAt }) : null;

  return (
    <PublicShell eyebrow={SALES_STATUS_LABELS[event.salesStatus]} subtitle={SALES_STATUS_LABELS[event.salesStatus]} title={event.title}>
      <div className="flex flex-col gap-6">
        <p className="text-sm">
          {formatDateTime(event.kickoffAt)} · {event.venue}
        </p>
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {categories.map((c) => {
            const left = remaining(c.capacity, taken.get(c.id) ?? 0);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  <strong>{c.name}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {c.gate} · {left > 0 ? `${left} place(s) disponible(s)` : "complet"}
                  </span>
                </span>
                <span className="text-right">
                  <strong>{formatFcfa(c.publicPrice)}</strong>
                  {c.memberPrice < c.publicPrice && <span className="block text-xs text-[var(--flag-green)]">membre {formatFcfa(c.memberPrice)}</span>}
                </span>
              </li>
            );
          })}
        </ul>

        {!fan ? (
          <p className="text-sm">
            Pour acheter, <Link href="/supporters/connexion" className="font-semibold underline">connectez-vous</Link> ou{" "}
            <Link href="/supporters/inscription" className="font-semibold underline">créez votre Fan ID</Link>.
          </p>
        ) : refusal ? (
          <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
            {refusal}
          </p>
        ) : (
          <BuyForm
            action={buyTickets.bind(null, event.id)}
            categories={categories.map((c) => ({ id: c.id, name: c.name, gate: c.gate, price: unitPrice(c, member), left: remaining(c.capacity, taken.get(c.id) ?? 0) }))}
            maxTickets={event.maxTicketsPerFan}
            buyerName={`${fan.firstName} ${fan.lastName}`}
            defaultMethod={methodForOperator(operatorOf(fan.phone))}
          />
        )}
      </div>
    </PublicShell>
  );
}
