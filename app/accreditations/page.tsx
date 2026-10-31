import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowIcon, CalendarIcon, CheckCircleIcon, ClockIcon, IdCardIcon, PinIcon, QrIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { REQUEST_DEADLINE_HOURS, requestDaysLeft, requestDeadline } from "@/lib/accreditations";
import { formatDateTime, kickoffTime } from "@/lib/format";
import { openForAccreditation } from "@/lib/queries/accreditations";

export const metadata: Metadata = { title: "Accréditations médias — FECOFOOT", description: "Demande d'accréditation presse pour les matchs de la FECOFOOT." };

const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit" });
const month = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", month: "short" });
const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "long" });

/** Les trois étapes d'une accréditation, de la demande au badge. */
const STEPS = [
  { icon: <IdCardIcon className="size-5" />, title: "Demande en ligne", text: `Un formulaire par match, au plus tard ${REQUEST_DEADLINE_HOURS} h avant le coup d'envoi, avec votre carte de presse (ou l'ordre de mission de votre média) et une photo d'identité.` },
  { icon: <CheckCircleIcon className="size-5" />, title: "Validation", text: "Le service communication de la fédération examine chaque demande et les zones demandées, selon les places disponibles." },
  { icon: <QrIcon className="size-5" />, title: "Badge numérique", text: "Une fois validée, votre badge à QR code est disponible depuis votre lien de suivi : présentez-le à l'entrée du stade." },
];

/** Accréditations presse : comment ça marche et matchs ouverts aux demandes (EF-MED-01). */
export default async function AccreditationsPage() {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const events = await openForAccreditation();
  return (
    <PublicShell eyebrow="Médias" title="Accréditations presse" subtitle="Journalistes, photographes et équipes de tournage : demandez votre accès aux matchs de la FECOFOOT." wide>
      <div className="flex flex-col gap-12">
        <section aria-labelledby="etapes" className="flex flex-col gap-5">
          <h2 id="etapes" data-reveal="left" className="text-2xl font-bold uppercase sm:text-3xl">
            Comment ça marche
          </h2>
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
        </section>

        <section aria-labelledby="matchs-ouverts" className="flex flex-col gap-5">
          <h2 id="matchs-ouverts" data-reveal="left" className="text-2xl font-bold uppercase sm:text-3xl">
            Matchs ouverts aux demandes
          </h2>
          {events.length === 0 ? (
            <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
              <CalendarIcon className="size-9 text-[var(--flag-green)]" />
              <p className="font-semibold">Aucun match ouvert aux demandes pour le moment.</p>
              <p className="max-w-md text-sm text-muted-foreground">Les demandes s&apos;ouvrent avec la billetterie de chaque match et se ferment {REQUEST_DEADLINE_HOURS} h avant le coup d&apos;envoi.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.map((e, i) => {
                const deadline = requestDeadline(e.kickoffAt);
                const daysLeft = requestDaysLeft(e.kickoffAt);
                return (
                  <li key={e.id} data-reveal="up" style={{ ["--rd" as string]: `${i * 120}ms` }}>
                    <Link
                      href={`/accreditations/${e.slug}`}
                      className="group grid overflow-hidden bg-muted/60 transition-[background-color,transform,box-shadow] duration-300 ease-out hover:bg-muted hover:shadow-[0_18px_36px_-22px_rgb(0_0_0/0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-1 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
                    >
                      {/* Date du match */}
                      <span className="flex items-center gap-3 bg-brand-ink px-5 py-4 text-white sm:flex-col sm:justify-center sm:gap-0.5 sm:py-6">
                        <span className="font-display text-4xl leading-none font-bold sm:text-5xl">{day.format(e.kickoffAt)}</span>
                        <span className="flex flex-col sm:items-center">
                          <span className="font-display text-sm font-bold tracking-[0.18em] text-[var(--flag-yellow)] uppercase">{month.format(e.kickoffAt).replace(".", "")}</span>
                          <span className="text-xs text-white/70 first-letter:uppercase">{weekday.format(e.kickoffAt)}</span>
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col justify-center gap-2.5 px-5 py-4 sm:px-6">
                        <span className="font-heading text-lg leading-snug font-bold sm:text-xl">{e.title}</span>
                        <span className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon className="size-4" />
                            Coup d&apos;envoi {kickoffTime(e.kickoffAt) ?? "à confirmer"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <PinIcon className="size-4" />
                            {e.venue}
                          </span>
                        </span>
                        <span className="inline-flex w-fit items-center gap-2 bg-[color-mix(in_srgb,var(--flag-green)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--flag-green)]">
                          <CalendarIcon className="size-3.5" />
                          Demandes jusqu&apos;au {formatDateTime(deadline)}
                          <span className="bg-[var(--flag-green)] px-1.5 text-white">{daysLeft > 0 ? `J-${daysLeft}` : "Dernier jour"}</span>
                        </span>
                      </span>
                      <span className="flex items-center px-5 pb-4 sm:px-6 sm:pb-0">
                        <span className="inline-flex items-center gap-2 bg-[var(--flag-green)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors group-hover:bg-brand-ink">
                          Demander une accréditation
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
      </div>
    </PublicShell>
  );
}
