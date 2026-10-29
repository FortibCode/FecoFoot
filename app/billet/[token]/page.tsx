import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/admin/print-button";
import { PublicShell } from "@/components/public/public-shell";
import { ETicket } from "@/components/public/e-ticket";
import { TicketCheck } from "@/components/public/ticket-check";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { appUrl, qrSvg } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";
import { verifyTicket } from "@/lib/queries/ticket-verify";

export const metadata: Metadata = { title: "Billet — FECOFOOT", robots: { index: false } };

/**
 * Adresse contenue dans le QR code du billet.
 *  - Son acheteur connecté : le billet en grand, à présenter à l'entrée (impression, PDF).
 *  - Toute autre personne qui scanne (steward, contrôleur, porteur) : vérification publique en lecture
 *    seule — authentique, payé, déjà utilisé ou non — sans jamais révéler le QR code lui-même.
 */
export default async function TicketPage({ params }: PageProps<"/billet/[token]">) {
  const { token } = await params;
  const fan = await getCurrentSupporter();
  const [t] = fan && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await supporterTickets(fan.id, token) : [];
  if (!t) {
    return (
      <PublicShell eyebrow="Billetterie" title="Vérification du billet">
        <TicketCheck t={await verifyTicket(token)} />
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="Mon billet" title={t.event} wide>
      {/* Impression au format d'un billet de stade (203 × 82 mm), le billet seul. */}
      <style>{`@page { size: 203mm 82mm; margin: 0; } @media print { .ticket-print { max-width: none !important; width: 203mm !important; } .ticket-print > div { aspect-ratio: auto !important; height: 82mm; border-radius: 0 !important; box-shadow: none !important; } }`}</style>
      <ETicket t={t} qr={await qrSvg(await appUrl(`/billet/${t.token}`))} />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <PrintButton label="Imprimer le billet" />
        {t.status === "VALID" && (
          <a href={`/billet/${t.token}/pdf`} className="text-sm font-semibold underline">
            Télécharger le PDF
          </a>
        )}
        <Link href="/supporters/espace#billets" className="text-sm underline">
          Tous mes billets
        </Link>
      </div>
    </PublicShell>
  );
}
