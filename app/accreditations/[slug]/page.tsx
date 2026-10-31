import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, CheckCircleIcon, ClockIcon, PinIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { REQUEST_DEADLINE_HOURS, requestDeadline } from "@/lib/accreditations";
import { formatDateTime, kickoffTime } from "@/lib/format";
import { openForAccreditation } from "@/lib/queries/accreditations";
import { requestAccreditation } from "../actions";
import { RequestForm } from "../RequestForm";

export const metadata: Metadata = { title: "Demande d'accréditation — FECOFOOT" };

const longDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Ce qu'il faut avoir sous la main avant de commencer. */
const CHECKLIST = [
  "Une carte de presse en cours de validité",
  "Une photo d'identité récente, de face (JPEG ou PNG)",
  "Une demande par match et par personne",
  `Au plus tard ${REQUEST_DEADLINE_HOURS} h avant le coup d'envoi`,
];

/** Demande d'accréditation en ligne (EF-MED-01) : formulaire en étapes et récapitulatif du match. */
export default async function AccreditationRequestPage({ params }: PageProps<"/accreditations/[slug]">) {
  const { slug } = await params;
  const event = (await openForAccreditation()).find((e) => e.slug === slug);
  if (!event) notFound();
  const deadline = requestDeadline(event.kickoffAt);
  return (
    <PublicShell eyebrow="Accréditation presse" title="Demande d'accréditation" subtitle={event.title} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div data-reveal="up">
          <RequestForm action={requestAccreditation.bind(null, event.id)} />
        </div>

        {/* Récapitulatif du match, visible pendant toute la saisie. */}
        <aside aria-label="Le match" className="order-first flex flex-col gap-4 lg:sticky lg:top-24 lg:order-none">
          <section data-reveal="right" className="relative isolate flex flex-col gap-4 overflow-hidden bg-[var(--flag-green)] p-5 text-white">
            <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[10%]">
              <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-yellow)" />
            </svg>
            <p className="font-display text-xs font-bold tracking-[0.2em] text-white/75 uppercase">Le match</p>
            <h2 className="pr-12 font-heading text-xl leading-snug font-bold">{event.title}</h2>
            <ul className="flex flex-col gap-2 pr-12 text-sm">
              <li className="flex items-start gap-2">
                <CalendarIcon className="mt-0.5 size-4" />
                <span className="first-letter:uppercase">{longDay.format(event.kickoffAt)}</span>
              </li>
              <li className="flex items-start gap-2">
                <ClockIcon className="mt-0.5 size-4" />
                Coup d&apos;envoi {kickoffTime(event.kickoffAt) ?? "à confirmer"}
              </li>
              <li className="flex items-start gap-2">
                <PinIcon className="mt-0.5 size-4" />
                {event.venue}
              </li>
            </ul>
            <p className="mr-12 border-t border-white/30 pt-3 text-sm">
              Demandes jusqu&apos;au <strong>{formatDateTime(deadline)}</strong>
            </p>
          </section>

          <section data-reveal="right" style={{ ["--rd" as string]: "120ms" }} className="flex flex-col gap-3 bg-muted/60 p-5">
            <h2 className="font-heading text-base font-bold">Avant de commencer</h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 size-4 text-[var(--flag-green)]" />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          <Link href="/accreditations" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
            ← Tous les matchs ouverts aux demandes
          </Link>
        </aside>
      </div>
    </PublicShell>
  );
}
