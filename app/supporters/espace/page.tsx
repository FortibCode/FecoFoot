import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sum } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { requireSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { memberships, supporterPoints } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { appUrl, qrSvg } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { ETicket } from "@/components/public/e-ticket";
import { formatCongoPhone, MEMBERSHIP_TIER_LABELS } from "@/lib/supporters";
import { UploadForm } from "@/components/admin/upload-form";
import { supporterPhotoUrl } from "@/lib/supporter-photo";
import { logoutSupporter, uploadMyPhoto } from "../actions";

export const metadata: Metadata = { title: "Mon espace supporter — FECOFOOT", robots: { index: false } };

/** Espace supporter : carte Fan ID, adhésion, points (EF-SUP-02, EF-SUP-05). */
export default async function SupporterSpacePage({ searchParams }: PageProps<"/supporters/espace">) {
  const s = await requireSupporter();
  const purchased = (await searchParams).achat === "ok";
  const season = seasonOf();
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
  const qrs = await Promise.all(myTickets.map(async (t) => qrSvg(await appUrl(`/billet/${t.token}`))));

  return (
    <PublicShell eyebrow="Mon espace supporter" title={`${s.firstName} ${s.lastName}`}>
      <div className="flex flex-col gap-8">
        {s.banned && (
          <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
            Votre Fan ID fait l&apos;objet d&apos;une interdiction de stade : achat de billets et accès au stade impossibles.
          </p>
        )}
        <article aria-label="Carte Fan ID" className="flex items-stretch overflow-hidden rounded-xl border bg-white text-black">
          <div className="w-2 bg-[linear-gradient(180deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée
            <img src={photo} alt="Ma photo d'identité" className="m-3 mr-0 h-28 w-22 self-center rounded-md object-cover" />
          )}
          <div className="flex flex-1 flex-col gap-1 p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">Fan ID · FECOFOOT</p>
            <p className="text-2xl font-extrabold tracking-tight">{s.fanId}</p>
            <p className="text-sm">{formatCongoPhone(s.phone)}</p>
            <p className="mt-2 text-sm">
              {member ? (
                <strong className="text-[var(--flag-green)]">
                  Membre {seasonLabel(season)} · {MEMBERSHIP_TIER_LABELS[member.tier]}
                </strong>
              ) : (
                <span className="text-gray-500">Non membre du club des supporters</span>
              )}
            </p>
            <p className="text-sm">
              Points de fidélité : <strong data-testid="fan-points">{Number(total ?? 0)}</strong>
            </p>
          </div>
          <div className="flex w-28 items-center p-3 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </article>

        <section className="flex flex-col gap-2" aria-label="Photo d'identité">
          {!photo && (
            <p className="text-sm">
              <strong>Ajoutez votre photo d&apos;identité</strong> : elle est exigée avant votre premier achat de billet et sera
              comparée à votre pièce d&apos;identité.
            </p>
          )}
          <UploadForm action={uploadMyPhoto} accept="image/jpeg,image/png,image/webp" label={photo ? "Changer ma photo" : "Ajouter ma photo"} />
        </section>

        {!member && !s.banned && (
          <Link href="/supporters/adhesion" className="w-fit rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Rejoindre le club des supporters
          </Link>
        )}
        {member?.activatedAt && <p className="text-sm text-muted-foreground">Adhésion active depuis le {formatDate(member.activatedAt)}.</p>}

        <section id="billets" className="flex flex-col gap-3">
          {purchased && (
            <p role="status" className="rounded-lg border border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_10%,transparent)] px-4 py-3 text-sm">
              <strong>Paiement confirmé.</strong> Vos billets sont ci-dessous ; une confirmation vous a été envoyée par SMS
              {s.email ? " et par e-mail" : ""}. Téléchargez-les en PDF pour les avoir même sans réseau au stade.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Mes billets</h2>
            {myTickets.some((t) => t.status === "VALID") && (
              <a href="/supporters/espace/billets" className="rounded-md bg-brand-ink px-3 py-2 text-xs font-semibold text-white">
                Télécharger tous mes billets (PDF)
              </a>
            )}
          </div>
          {myTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun billet pour le moment. <Link href="/billetterie" className="underline">Voir les matchs en vente</Link>
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Présentez le QR code à l&apos;entrée (écran ou capture d&apos;écran). Une pièce d&apos;identité peut être demandée. Toute revente est interdite.</p>
              {myTickets.map((t, i) => (
                <div key={t.id} className="flex flex-col gap-2">
                  <ETicket t={t} qr={qrs[i]} />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Link href={`/billet/${t.token}`} className="font-semibold underline">
                      Afficher en grand
                    </Link>
                    {t.status === "VALID" && (
                      <a href={`/billet/${t.token}/pdf`} className="font-semibold underline">
                        Télécharger le PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>

        <form action={logoutSupporter}>
          <Button type="submit" variant="outline" className="h-10">
            Se déconnecter
          </Button>
        </form>
      </div>
    </PublicShell>
  );
}
