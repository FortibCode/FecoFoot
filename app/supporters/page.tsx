import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowIcon, CheckCircleIcon, GroupIcon, IdCardIcon, QrIcon, TicketIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { membershipPlans } from "@/lib/db/schema";
import { formatFcfa } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { MEMBERSHIP_TIER_LABELS } from "@/lib/supporters";

export const metadata: Metadata = {
  title: "Supporters : Fan ID et club des supporters — FECOFOOT",
  description: "Créez votre Fan ID pour acheter vos billets et rejoignez le club des supporters de la FECOFOOT.",
};

/** Ce que donnent le Fan ID et l'adhésion au club. */
const FAN_ID = ["Gratuit, créé en quelques minutes avec votre téléphone", "Obligatoire pour acheter des billets : chaque billet est à votre nom", "Billets numériques à QR code, payés par Airtel Money ou MTN MoMo"];
const CLUB = ["Prévente réservée aux membres pour les grands matchs", "Tarif membre réduit sur les billets", "Points de fidélité à chaque match"];

/** Supporters : Fan ID, club des supporters et tarifs d'adhésion de la saison (EF-SUP-01, EF-SUP-02). */
export default async function SupportersPage() {
  const me = await getCurrentSupporter();
  const season = seasonOf();
  const plans = await db
    .select()
    .from(membershipPlans)
    .where(and(eq(membershipPlans.season, season), eq(membershipPlans.open, true)))
    .orderBy(asc(membershipPlans.tier));
  const benefits = (items: string[], light: boolean) => (
    <ul className="flex flex-col gap-2.5 text-sm">
      {items.map((b) => (
        <li key={b} className="flex items-start gap-2">
          <CheckCircleIcon className={`mt-0.5 size-4 shrink-0 ${light ? "text-[var(--flag-yellow)]" : "text-[var(--flag-green)]"}`} />
          {b}
        </li>
      ))}
    </ul>
  );

  return (
    <PublicShell eyebrow="Supporters" title="Fan ID et club des supporters" subtitle="Votre identifiant de supporter pour acheter vos billets, et le club pour vivre les matchs des Diables Rouges au plus près." wide>
      <div className="flex flex-col gap-10">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Fan ID */}
          <section aria-labelledby="fan-id" data-reveal="left" className="relative isolate flex flex-col gap-5 overflow-hidden bg-brand-ink p-6 text-white sm:p-8">
            <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[9%]">
              <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-green)" />
            </svg>
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-[var(--flag-green)]">
              <IdCardIcon className="size-6" />
            </span>
            <div className="flex flex-col gap-1 pr-14">
              <h2 id="fan-id" className="font-display text-3xl font-bold uppercase">
                Le Fan ID
              </h2>
              <p className="text-sm text-white/80">
                Votre <strong className="text-white">identifiant de supporter</strong> : les billets sont numériques, à votre nom, et présentés à l&apos;entrée du stade avec un QR code.
              </p>
            </div>
            <div className="pr-14">{benefits(FAN_ID, true)}</div>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {me ? (
                <Link href="/supporters/espace" className="inline-flex items-center gap-2 bg-[var(--flag-green)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-brand-ink">
                  Mon espace supporter
                  <ArrowIcon className="size-4" />
                </Link>
              ) : (
                <>
                  <Link href="/supporters/inscription" className="inline-flex items-center gap-2 bg-[var(--flag-green)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-brand-ink">
                    Créer mon Fan ID
                  </Link>
                  <Link href="/supporters/connexion" className="inline-flex items-center gap-2 border border-white/40 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10">
                    J&apos;ai déjà un Fan ID
                  </Link>
                </>
              )}
            </div>
          </section>

          {/* Club des supporters */}
          <section aria-labelledby="club" data-reveal="right" style={{ ["--rd" as string]: "120ms" }} className="relative isolate flex flex-col gap-5 overflow-hidden bg-muted/60 p-6 sm:p-8">
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-[var(--flag-green)] text-white">
              <GroupIcon className="size-6" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="club" className="font-display text-3xl font-bold uppercase">
                Le club des supporters
              </h2>
              <p className="text-sm text-muted-foreground">Une adhésion par saison, payée par Mobile Money, réservée aux détenteurs d&apos;un Fan ID.</p>
            </div>
            {benefits(CLUB, false)}
            {plans.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Adhésion {seasonLabel(season)}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {plans.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 bg-card px-4 py-3">
                      <span className="font-semibold">{MEMBERSHIP_TIER_LABELS[p.tier]}</span>
                      <span className="font-display text-xl font-bold">{formatFcfa(p.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-auto pt-2">
              <Link
                href={me ? "/supporters/adhesion" : "/supporters/inscription"}
                className="inline-flex items-center gap-2 bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--flag-green)]"
              >
                {me ? "Rejoindre le club" : "Adhérer au club (Fan ID requis)"}
                <ArrowIcon className="size-4" />
              </Link>
            </div>
          </section>
        </div>

        {/* Au stade */}
        <section aria-label="Au stade" data-reveal="up" className="grid gap-3 bg-muted/60 p-5 sm:grid-cols-3 sm:p-6">
          {(
            [
              [<TicketIcon key="t" className="size-5" />, "Achetez", "Choisissez votre tribune sur la billetterie et payez sur votre téléphone."],
              [<QrIcon key="q" className="size-5" />, "Présentez", "À l'entrée, ouvrez votre billet et présentez son QR code (écran, capture ou PDF)."],
              [<IdCardIcon key="i" className="size-5" />, "Entrez", "Une pièce d'identité peut être demandée : le billet est à votre nom, toute revente est interdite."],
            ] as const
          ).map(([icon, title, text]) => (
            <div key={title} className="flex items-start gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-[var(--flag-green)]">
                {icon}
              </span>
              <div>
                <p className="font-heading font-bold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </PublicShell>
  );
}
