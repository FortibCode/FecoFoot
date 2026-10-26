import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { PressBadge } from "@/components/public/press-badge";
import { PublicShell } from "@/components/public/public-shell";
import { pressPhotoUrl } from "@/lib/accreditations";
import { appUrl, qrSvg } from "@/lib/qr";
import { accreditationByBadge } from "@/lib/queries/accreditations";

export const metadata: Metadata = { title: "Badge presse — FECOFOOT", robots: { index: false } };

/**
 * Badge numérique du journaliste (EF-MED-04), valable uniquement pour le match demandé (RG-16) :
 * à présenter à l'écran, à imprimer ou à télécharger en PDF. Le QR code mène à la page de vérification
 * (…/verifier) : la personne qui le scanne voit la photo et la validité, jamais le badge lui-même.
 */
export default async function BadgePage({ params }: PageProps<"/accreditations/badge/[token]">) {
  const { token } = await params;
  const row = await accreditationByBadge(token);
  if (!row) notFound();
  const { acc, event } = row;
  if (acc.status !== "APPROVED") {
    return (
      <PublicShell eyebrow="Accréditation" title="Badge non valide">
        <p className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm">Ce badge n&apos;est pas (ou plus) valide : l&apos;accréditation n&apos;est pas approuvée.</p>
      </PublicShell>
    );
  }
  const qr = await qrSvg(await appUrl(`/accreditations/badge/${token}/verifier`));
  return (
    <PublicShell eyebrow="Accréditation" title="Mon badge presse">
      <div className="flex flex-col items-center gap-6">
        <PressBadge
          qr={qr}
          photo={pressPhotoUrl(acc)}
          a={{ ...acc, grantedZones: acc.grantedZones ?? [], event: event.title, kickoffAt: event.kickoffAt, venue: event.venue }}
        />
        <div className="flex flex-wrap items-center justify-center gap-4 print:hidden">
          <PrintButton label="Imprimer le badge" />
          <a href={`/accreditations/badge/${token}/pdf`} className="text-sm font-semibold underline">
            Télécharger le PDF
          </a>
        </div>
        <p className="max-w-md text-center text-xs text-muted-foreground print:hidden">
          Présentez ce badge au contrôle d&apos;accès avec votre carte de presse. Il n&apos;ouvre que les zones en vert, et uniquement pour ce match.
        </p>
      </div>
    </PublicShell>
  );
}
