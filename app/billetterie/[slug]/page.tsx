import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowIcon, CalendarIcon, ClockIcon, PinIcon, TicketIcon, WalletIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { SectionTitle } from "@/components/public/section-title";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { ticketCategories, ticketEvents } from "@/lib/db/schema";
import { formatDateTime, formatFcfa } from "@/lib/format";
import { methodForOperator } from "@/lib/payments-rules";
import { operatorOf } from "@/lib/supporters";
import { isActiveMember, takenByCategory } from "@/lib/ticket-sales";
import { EVENT_KIND_LABELS, parseEventTitle, purchaseError, remaining, SALES_STATUS_LABELS, unitPrice } from "@/lib/ticketing";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { buyTickets } from "../actions";
import { BuyForm } from "../BuyForm";

const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

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
  // Billets déjà achetés par le supporter connecté pour ce match.
  const mine = fan ? (await supporterTickets(fan.id)).filter((t) => t.eventId === event.id && t.status !== "CANCELLED") : [];
  const { competition, detail, match, teams } = parseEventTitle(event.title);
  const day = dayFmt.format(event.kickoffAt);

  return (
    <PublicShell eyebrow="Billetterie" title={teams ? `${teams[0]} – ${teams[1]}` : match} subtitle={[competition ?? EVENT_KIND_LABELS[event.kind], detail].filter(Boolean).join(" · ")} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <dl className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Date", day.charAt(0).toUpperCase() + day.slice(1), <CalendarIcon key="d" className="size-5" />],
                ["Coup d'envoi", timeFmt.format(event.kickoffAt), <ClockIcon key="h" className="size-5" />],
                ["Stade", event.venue, <PinIcon key="s" className="size-5" />],
              ] as const
            ).map(([k, v, icon], i) => (
              <div key={k} data-reveal="left" style={{ ["--rd" as string]: `${i * 110}ms` }} className="flex items-start gap-3 bg-muted/60 p-4">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]">
                  {icon}
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{k}</dt>
                  <dd className="mt-0.5 font-heading text-lg leading-tight font-bold">{v}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section aria-labelledby="tribunes" className="flex flex-col gap-4">
            <SectionTitle
              id="tribunes"
              icon={<TicketIcon className="size-5" />}
              title="Tribunes et tarifs"
              text="Places restantes en temps réel ; tarif réduit pour les membres du club des supporters."
              aside={<span className={`px-3 py-1 text-xs font-bold ${event.salesStatus === "PRESALE" ? "bg-[var(--flag-yellow)] text-brand-ink" : "bg-[var(--flag-green)] text-white"}`}>{SALES_STATUS_LABELS[event.salesStatus]}</span>}
            />
            <ul className="flex flex-col gap-3">
              {categories.map((c) => {
                const left = remaining(c.capacity, taken.get(c.id) ?? 0);
                const filled = Math.min(100, Math.round(((c.capacity - left) / Math.max(1, c.capacity)) * 100));
                return (
                  <li key={c.id} data-reveal="up" style={{ ["--rd" as string]: `${categories.indexOf(c) * 100}ms` }} className="bg-muted/60 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-lg font-bold">{c.name}</p>
                        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <PinIcon className="size-3.5" />
                          {c.gate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold">{formatFcfa(c.publicPrice)}</p>
                        {c.memberPrice < c.publicPrice && <p className="mt-1 inline-block bg-[color-mix(in_srgb,var(--flag-green)_12%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--flag-green)]">membre : {formatFcfa(c.memberPrice)}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                        <div className={`h-full rounded-full ${filled >= 90 ? "bg-[var(--flag-red)]" : filled >= 60 ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-green)]"}`} style={{ width: `${Math.max(filled, 2)}%` }} />
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${left > 0 ? "text-muted-foreground" : "text-[var(--flag-red)]"}`}>{left > 0 ? `${left.toLocaleString("fr-FR")} place(s) disponible(s)` : "Complet"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Billets 100 % numériques et nominatifs, avec QR code, payés par Airtel Money ou MTN MoMo. Au plus {event.maxTicketsPerFan} billets par Fan ID.
            </p>
          </section>
        </div>

        <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none">
          {mine.length > 0 && (
            <div data-reveal="right" className="bg-[var(--flag-green)] p-5 text-white">
              <p className="flex items-center gap-2 font-semibold">
                <TicketIcon className="size-5" />
                Vous avez {mine.length} billet{mine.length > 1 ? "s" : ""} pour ce match
              </p>
              <ul className="mt-2 text-sm text-white/85">
                {mine.map((t) => (
                  <li key={t.id}>
                    {t.holderName} · {t.category} · {t.number}
                  </li>
                ))}
              </ul>
              <Link href="/supporters/espace#billets" className="mt-4 inline-flex items-center gap-2 bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-brand-ink">
                Voir mes billets
                <ArrowIcon className="size-4" />
              </Link>
            </div>
          )}

          <div data-reveal="right" style={{ ["--rd" as string]: "120ms" }} className="bg-muted/60 p-5">
            <h2 className="mb-4 flex items-center gap-2.5 font-heading text-xl font-bold uppercase">
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[var(--flag-green)] text-white">
                <WalletIcon className="size-4" />
              </span>
              {mine.length > 0 ? "Acheter d'autres billets" : "Acheter des billets"}
            </h2>
            {!fan ? (
              <div className="flex flex-col gap-3 text-sm">
                <p>Un Fan ID est nécessaire pour acheter : chaque billet est nominatif.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/supporters/connexion" className="rounded-md bg-brand-ink px-4 py-2 font-semibold text-white">
                    Se connecter
                  </Link>
                  <Link href="/supporters/inscription" className="rounded-md border px-4 py-2 font-semibold hover:bg-muted">
                    Créer mon Fan ID
                  </Link>
                </div>
              </div>
            ) : refusal ? (
              <div className="flex flex-col gap-3 text-sm">
                <p role="alert" className="border-l-4 border-[var(--flag-red)] bg-[color-mix(in_srgb,var(--flag-red)_8%,transparent)] p-3">
                  {refusal}
                </p>
                {event.salesStatus === "PRESALE" && !member && !fan.banned && (
                  <>
                    <p>Devenez membre du club des supporters pour acheter dès la prévente, au tarif membre. Sinon, revenez à l&apos;ouverture de la vente au grand public.</p>
                    <Link href="/supporters/adhesion" className="w-fit rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
                      Rejoindre le club des supporters
                    </Link>
                  </>
                )}
              </div>
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
        </aside>
      </div>
    </PublicShell>
  );
}
