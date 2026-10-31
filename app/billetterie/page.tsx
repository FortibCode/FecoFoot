import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, asc, gt, inArray } from "drizzle-orm";
import { ArrowIcon, CalendarIcon, ClockIcon, IdCardIcon, PinIcon, QrIcon, TicketIcon, WalletIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { SectionTitle } from "@/components/public/section-title";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { db } from "@/lib/db";
import { ticketEvents } from "@/lib/db/schema";
import { kickoffTime } from "@/lib/format";
import { EVENT_KIND_LABELS, parseEventTitle, SALES_STATUS_LABELS } from "@/lib/ticketing";

export const metadata: Metadata = { title: "Billetterie — FECOFOOT", description: "Billets numériques et nominatifs pour les matchs de la FECOFOOT, payés par Mobile Money." };

const TZ = "Africa/Brazzaville";
const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit" });
const month = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" });
const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" });

/** Les trois étapes d'un achat, du Fan ID à l'entrée au stade. */
const STEPS = [
  { icon: <IdCardIcon className="size-5" />, title: "Votre Fan ID", text: "Gratuit, créé une fois avec votre numéro de téléphone : chaque billet est nominatif." },
  { icon: <WalletIcon className="size-5" />, title: "Tribune et paiement", text: "Choisissez votre tribune et payez par Airtel Money ou MTN MoMo, directement sur votre téléphone." },
  { icon: <QrIcon className="size-5" />, title: "Billet à QR code", text: "Votre billet numérique est dans votre espace supporter : présentez son QR code à l'entrée du stade." },
];

/** Billetterie : comment acheter et matchs en vente (EF-BIL-02). */
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
    <PublicShell eyebrow="Billetterie" title="Matchs en vente" subtitle="Billets 100 % numériques et nominatifs, réservés aux détenteurs d'un Fan ID, payés par Airtel Money ou MTN MoMo." wide>
      <div className="flex flex-col gap-12">
        {mine.length > 0 && (
          <Link
            href="/supporters/espace#billets"
            data-reveal="up"
            className="group relative isolate flex flex-wrap items-center justify-between gap-4 overflow-hidden bg-[var(--flag-green)] px-5 py-5 text-white sm:px-6"
          >
            <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[14%]">
              <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-yellow)" />
            </svg>
            <span className="flex items-center gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
                <TicketIcon className="size-5" />
              </span>
              <span>
                <strong className="block text-lg">
                  Vous avez {mine.length} billet{mine.length > 1 ? "s" : ""}
                </strong>
                <span className="text-sm text-white/85">pour {new Set(mine.map((t) => t.eventId)).size > 1 ? "vos prochains matchs" : "le prochain match"}.</span>
              </span>
            </span>
            <span className="mr-12 inline-flex items-center gap-2 bg-brand-ink px-4 py-2.5 text-sm font-semibold transition-colors group-hover:bg-white group-hover:text-brand-ink">
              Voir mes billets
              <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        )}

        <section aria-labelledby="matchs-vente" className="flex flex-col gap-5">
          <SectionTitle id="matchs-vente" icon={<TicketIcon className="size-5" />} title="Prochains matchs" text="Prévente réservée aux membres du club des supporters, puis vente ouverte à tous." />
          {events.length === 0 ? (
            <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
              <TicketIcon className="size-9 text-[var(--flag-green)]" />
              <p className="font-semibold">Aucun match en vente pour le moment.</p>
              <p className="max-w-md text-sm text-muted-foreground">Les billets sont mis en vente quelques semaines avant chaque match. Créez votre Fan ID dès maintenant pour être prêt.</p>
              <Link href="/supporters" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                Créer mon Fan ID
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.map((e, i) => {
                const { competition, detail, match, teams } = parseEventTitle(e.title);
                return (
                  <li key={e.id} data-reveal="up" style={{ ["--rd" as string]: `${i * 120}ms` }}>
                    <Link
                      href={`/billetterie/${e.slug}`}
                      className="group grid overflow-hidden bg-muted/60 transition-[background-color,transform,box-shadow] duration-300 ease-out hover:bg-muted hover:shadow-[0_18px_36px_-22px_rgb(0_0_0/0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-1 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
                    >
                      <span className="flex items-center gap-3 bg-brand-ink px-5 py-4 text-white sm:flex-col sm:justify-center sm:gap-0.5 sm:py-6">
                        <span className="font-display text-4xl leading-none font-bold sm:text-5xl">{day.format(e.kickoffAt)}</span>
                        <span className="flex flex-col sm:items-center">
                          <span className="font-display text-sm font-bold tracking-[0.18em] text-[var(--flag-yellow)] uppercase">{month.format(e.kickoffAt).replace(".", "")}</span>
                          <span className="text-xs text-white/70 first-letter:uppercase">{weekday.format(e.kickoffAt)}</span>
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col justify-center gap-2 px-5 py-4 sm:px-6">
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-muted-foreground">{[competition ?? EVENT_KIND_LABELS[e.kind], detail].filter(Boolean).join(" · ")}</span>
                          <span className={`px-2 py-0.5 font-bold ${e.salesStatus === "PRESALE" ? "bg-[var(--flag-yellow)] text-brand-ink" : "bg-[var(--flag-green)] text-white"}`}>{SALES_STATUS_LABELS[e.salesStatus]}</span>
                        </span>
                        <span className="font-display text-2xl leading-tight font-bold uppercase sm:text-3xl">{teams ? `${teams[0]} – ${teams[1]}` : match}</span>
                        <span className="sr-only">{e.title}</span>
                        <span className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon className="size-4" />
                            {kickoffTime(e.kickoffAt) ?? "Heure à confirmer"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <PinIcon className="size-4" />
                            {e.venue}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center px-5 pb-4 sm:px-6 sm:pb-0">
                        <span className="inline-flex items-center gap-2 bg-[var(--flag-green)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors group-hover:bg-brand-ink">
                          Acheter des billets
                          <ArrowIcon className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="comment-acheter" className="flex flex-col gap-5">
          <SectionTitle id="comment-acheter" icon={<CalendarIcon className="size-5" />} title="Comment acheter" />
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} data-reveal="left" style={{ ["--rd" as string]: `${i * 140}ms` }} className="relative flex flex-col gap-3 overflow-hidden bg-muted/60 p-5 sm:p-6">
                <span aria-hidden className="absolute -top-3 right-3 font-display text-8xl leading-none font-bold text-[color-mix(in_srgb,var(--flag-green)_12%,transparent)]">
                  {i + 1}
                </span>
                <span aria-hidden className="grid size-11 place-items-center rounded-full bg-[var(--flag-green)] text-white">
                  {s.icon}
                </span>
                <h3 className="font-heading text-lg font-bold">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Pas encore de Fan ID ?{" "}
            <Link href="/supporters" className="font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
              Créez-le en quelques minutes
            </Link>
            .
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
