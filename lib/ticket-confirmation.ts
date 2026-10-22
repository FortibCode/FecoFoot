import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supporters, ticketEvents, ticketOrders, tickets } from "@/lib/db/schema";
import { notify } from "@/lib/notify";

const TZ = "Africa/Brazzaville";
const whenFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Confirmation d'achat (EF-BIL-07) : SMS et e-mail à l'acheteur avec le lien vers ses billets,
 * une fois la commande payée. Un échec d'envoi ne remet jamais en cause l'achat (billets dans l'espace).
 */
export async function sendTicketConfirmation(orderId: number): Promise<void> {
  const [o] = await db
    .select({ reference: ticketOrders.reference, status: ticketOrders.status, phone: supporters.phone, email: supporters.email, firstName: supporters.firstName, event: ticketEvents.title, kickoffAt: ticketEvents.kickoffAt, venue: ticketEvents.venue })
    .from(ticketOrders)
    .innerJoin(supporters, eq(ticketOrders.supporterId, supporters.id))
    .innerJoin(ticketEvents, eq(ticketOrders.eventId, ticketEvents.id))
    .where(eq(ticketOrders.id, orderId))
    .limit(1);
  if (!o || o.status !== "PAID") return;
  const [{ n }] = await db.select({ n: count() }).from(tickets).where(and(eq(tickets.orderId, orderId), eq(tickets.status, "VALID")));
  const link = new URL("/supporters/espace", process.env.APP_URL ?? "http://localhost:3000").toString();
  const match = o.event.includes(" : ") ? o.event.slice(o.event.indexOf(" : ") + 3) : o.event;
  const when = whenFmt.format(o.kickoffAt).replace(" ", " à ");
  await notify(
    { phone: o.phone, email: o.email },
    {
      topic: "ticket_confirmation",
      subject: `Vos billets — ${match}`,
      sms: `FECOFOOT : paiement reçu. ${n} billet(s) pour ${match}, le ${when}, ${o.venue}. Billets et QR code : ${link} (commande ${o.reference}).`,
      email: `Bonjour ${o.firstName},\n\nVotre paiement est confirmé (commande ${o.reference}).\n\n${n} billet(s) pour ${o.event}\nLe ${when} — ${o.venue}\n\nVos billets sont dans votre espace supporter, avec leur QR code et la version PDF à imprimer :\n${link}\n\nPrésentez le QR code à l'entrée (sur votre téléphone ou imprimé). Chaque billet est nominatif et ne permet qu'une seule entrée.\n\nFECOFOOT — Fédération Congolaise de Football`,
    },
  );
}
