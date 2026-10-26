import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, asc, gt, inArray } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { db } from "@/lib/db";
import { ticketEvents } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { EVENT_KIND_LABELS, SALES_STATUS_LABELS } from "@/lib/ticketing";

export const metadata: Metadata = { title: "Billetterie — FECOFOOT", description: "Billets numériques et nominatifs pour les matchs de la FECOFOOT, payés par Mobile Money." };

export default async function TicketingPage() {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const events = await db
    .select()
    .from(ticketEvents)
    .where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN"]), gt(ticketEvents.kickoffAt, new Date())))
    .orderBy(asc(ticketEvents.kickoffAt));
  // Supporter connecté : rappel de ses billets à venir, avec accès direct.
  const fan = await getCurrentSupporter();
  const now = new Date();
  const mine = fan ? (await supporterTickets(fan.id)).filter((t) => t.status === "VALID" && t.kickoffAt > now) : [];
  return (
    <PublicShell eyebrow="Billetterie" title="Matchs en vente" wide>
      <p className="mb-6 text-sm text-muted-foreground">
        Billets 100 % numériques et nominatifs, réservés aux détenteurs d&apos;un{" "}
        <Link href="/supporters" className="underline">
          Fan ID
        </Link>
        , payés par Airtel Money ou MTN MoMo.
      </p>
      {mine.length > 0 && (
        <Link
          href="/supporters/espace#billets"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_8%,transparent)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklch,var(--flag-green)_14%,transparent)]"
        >
          <span>
            <strong>
              Vous avez {mine.length} billet{mine.length > 1 ? "s" : ""}
            </strong>{" "}
            pour {new Set(mine.map((t) => t.eventId)).size > 1 ? "vos prochains matchs" : "le prochain match"}.
          </span>
          <span className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Voir mes billets →</span>
        </Link>
      )}
      {events.length === 0 ? (
        <p className="text-muted-foreground">Aucun match en vente pour le moment.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/billetterie/${e.slug}`} className="block rounded-lg border p-4 hover:bg-muted">
                <p className="text-xs text-muted-foreground">
                  {EVENT_KIND_LABELS[e.kind]} · {SALES_STATUS_LABELS[e.salesStatus]}
                </p>
                <p className="font-semibold">{e.title}</p>
                <p className="text-sm">
                  {formatDateTime(e.kickoffAt)} · {e.venue}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
