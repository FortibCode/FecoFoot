import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sum } from "drizzle-orm";
import { ArrowIcon, GroupIcon, TicketIcon, UserIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { SectionTitle } from "@/components/public/section-title";
import { Button } from "@/components/ui/button";
import { requireSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { memberships, supporterPoints } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { appUrl, qrSvg } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { TicketWallet } from "@/components/public/ticket-wallet";
import { formatCongoPhone, MEMBERSHIP_TIER_LABELS } from "@/lib/supporters";
import { UploadForm } from "@/components/admin/upload-form";
import { supporterPhotoUrl } from "@/lib/supporter-photo";
import { logoutSupporter, uploadMyPhoto } from "../actions";

export const metadata: Metadata = { title: "Mon espace supporter — FECOFOOT", robots: { index: false } };

/** Espace supporter : carte Fan ID, adhésion, points (EF-SUP-02, EF-SUP-05). */
export default async function SupporterSpacePage({ searchParams }: PageProps<"/supporters/espace">) {
  const s = await requireSupporter();
  const sp = await searchParams;
  const purchased = sp.achat === "ok";
  // Après le paiement de l'adhésion : ce n'est pas un achat de billet, on le dit clairement.
  const joined = sp.adhesion === "ok";
  const season = seasonOf();
  const now = new Date();
  const [[member], [{ total }]] = await Promise.all([
    db
      .select()
      .from(memberships)
      .where(and(eq(memberships.supporterId, s.id), eq(memberships.season, season), eq(memberships.status, "ACTIVE")))
      .orderBy(desc(memberships.activatedAt))
      .limit(1),
    db.select({ total: sum(supporterPoints.points) }).from(supporterPoints).where(eq(supporterPoints.supporterId, s.id)),
  ]);
  const qr = await qrSvg(s.fanId);
  const photo = supporterPhotoUrl(s);
  const myTickets = await supporterTickets(s.id);
  const qrs = new Map(await Promise.all(myTickets.map(async (t) => [t.id, await qrSvg(await appUrl(`/billet/${t.token}`))] as const)));

  return (
    <PublicShell eyebrow="Mon espace supporter" title={`${s.firstName} ${s.lastName}`} subtitle="Votre Fan ID, vos billets et votre adhésion au club des supporters." wide>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {s.banned && (
            <p role="alert" className="border-l-4 border-[var(--flag-red)] bg-[color-mix(in_srgb,var(--flag-red)_8%,transparent)] p-4 text-sm">
              Votre Fan ID fait l&apos;objet d&apos;une interdiction de stade : achat de billets et accès au stade impossibles.
            </p>
          )}

          {/* Carte Fan ID : à présenter avec les billets. */}
          <article aria-label="Carte Fan ID" data-reveal="up" className="relative isolate overflow-hidden bg-brand-ink text-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.55)]">
            <span aria-hidden className="block h-1.5 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
            <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[22%] opacity-90">
              <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-green)" />
            </svg>
            <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5 sm:pr-6">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée
                <img src={photo} alt="Ma photo d'identité" className="h-24 w-18 shrink-0 object-cover ring-2 ring-white/80 sm:h-28 sm:w-22" />
              ) : (
                <span aria-hidden className="grid h-24 w-18 shrink-0 place-items-center bg-white/10 text-white/60 sm:h-28 sm:w-22">
                  <UserIcon className="size-9" />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-display text-[0.7rem] font-bold tracking-[0.22em] text-white/70 uppercase">Fan ID · FECOFOOT</p>
                <p className="font-display text-2xl leading-none font-bold tracking-wide whitespace-nowrap">{s.fanId}</p>
                <p className="text-sm text-white/80">{formatCongoPhone(s.phone)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                  {member ? (
                    <span className="bg-[var(--flag-yellow)] px-2 py-0.5 text-brand-ink">
                      Membre {seasonLabel(season)} · {MEMBERSHIP_TIER_LABELS[member.tier]}
                    </span>
                  ) : (
                    <span className="bg-white/15 px-2 py-0.5 text-white/80">Non membre du club des supporters</span>
                  )}
                  <span className="bg-white/15 px-2 py-0.5">
                    Points de fidélité : <strong data-testid="fan-points">{Number(total ?? 0)}</strong>
                  </span>
                </div>
              </div>
              <div className="grid size-20 shrink-0 place-items-center bg-white p-1.5 sm:size-24 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          </article>

          <section aria-label="Photo d'identité" data-reveal="up" style={{ ["--rd" as string]: "100ms" }} className="flex flex-col gap-3 bg-muted/60 p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold">
              <UserIcon className="size-4 text-[var(--flag-green)]" />
              Photo d&apos;identité
            </h2>
            <p className="text-sm text-muted-foreground">
              {photo ? "Elle figure sur votre carte et peut être comparée à votre pièce d'identité à l'entrée du stade." : "Elle est exigée avant votre premier achat de billet et sera comparée à votre pièce d'identité."}
            </p>
            <UploadForm action={uploadMyPhoto} accept="image/jpeg,image/png,image/webp" label={photo ? "Changer ma photo" : "Ajouter ma photo"} />
          </section>

          <section aria-label="Club des supporters" data-reveal="up" style={{ ["--rd" as string]: "200ms" }} className="flex flex-col gap-3 bg-muted/60 p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold">
              <GroupIcon className="size-4 text-[var(--flag-green)]" />
              Club des supporters
            </h2>
            {member ? (
              <p className="text-sm text-muted-foreground">
                {member.activatedAt ? `Adhésion active depuis le ${formatDate(member.activatedAt)}.` : "Adhésion active."} Prévente des grands matchs, tarif membre et points de fidélité.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Prévente des grands matchs, tarif réduit sur les billets et points de fidélité à chaque match.</p>
                {!s.banned && (
                  <Link href="/supporters/adhesion" className="inline-flex w-fit items-center gap-2 bg-[var(--flag-green)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink">
                    Rejoindre le club des supporters
                    <ArrowIcon className="size-4" />
                  </Link>
                )}
              </>
            )}
          </section>

          <form action={logoutSupporter}>
            <Button type="submit" variant="outline" className="h-10">
              Se déconnecter
            </Button>
          </form>
        </div>

        <section id="billets" aria-labelledby="billets-title" className="order-first flex min-w-0 flex-col gap-5 lg:order-none">
          {joined && (
            <p role="status" className="border-l-4 border-[var(--flag-green)] bg-[color-mix(in_srgb,var(--flag-green)_10%,transparent)] px-4 py-3 text-sm">
              <strong>Adhésion confirmée : bienvenue au club des supporters.</strong> Ce paiement concerne votre adhésion, pas un billet. Vous pouvez
              maintenant acheter vos billets en prévente, au tarif membre :{" "}
              <Link href="/billetterie" className="font-semibold underline">
                voir les matchs en vente
              </Link>
              .
            </p>
          )}
          {purchased && (
            <p role="status" className="border-l-4 border-[var(--flag-green)] bg-[color-mix(in_srgb,var(--flag-green)_10%,transparent)] px-4 py-3 text-sm">
              <strong>Paiement confirmé.</strong> Vos billets sont ci-dessous ; une confirmation vous a été envoyée par SMS
              {s.email ? " et par e-mail" : ""}. Téléchargez-les en PDF pour les avoir même sans réseau au stade.
            </p>
          )}
          <SectionTitle
            id="billets-title"
            icon={<TicketIcon className="size-5" />}
            title="Mes billets"
            text={myTickets.length > 0 ? "À l'entrée, ouvrez le billet et présentez son QR code (écran, capture ou PDF imprimé). Une pièce d'identité peut être demandée. Toute revente est interdite." : undefined}
            aside={
              myTickets.some((t) => t.status === "VALID") && (
                <a href="/supporters/espace/billets" className="inline-flex items-center gap-2 bg-brand-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--flag-green)]">
                  Télécharger tous mes billets (PDF)
                </a>
              )
            }
          />
          {myTickets.length === 0 ? (
            <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
              <TicketIcon className="size-9 text-[var(--flag-green)]" />
              <p className="font-semibold">Aucun billet pour le moment.</p>
              <Link href="/billetterie" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                Voir les matchs en vente
              </Link>
            </div>
          ) : (
            <TicketWallet tickets={myTickets} qrs={qrs} now={now} />
          )}
        </section>
      </div>
    </PublicShell>
  );
}
