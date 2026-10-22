import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ETicket } from "@/components/public/e-ticket";
import { PrintButton } from "@/components/admin/print-button";
import { PublicShell } from "@/components/public/public-shell";
import { requireSupporter } from "@/lib/auth/fan-session";
import { appUrl, qrSvg } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";

export const metadata: Metadata = { title: "Mon billet — FECOFOOT", robots: { index: false } };

/** Un billet en grand, à présenter à l'entrée. Visible uniquement par son acheteur. */
export default async function TicketPage({ params }: PageProps<"/billet/[token]">) {
  const s = await requireSupporter();
  const { token } = await params;
  const [t] = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await supporterTickets(s.id, token) : [];
  if (!t) notFound();
  return (
    <PublicShell eyebrow="Mon billet" title={t.event} wide>
      <ETicket t={t} qr={await qrSvg(await appUrl(`/billet/${t.token}`))} />
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <PrintButton label="Imprimer le billet" />
        {t.status === "VALID" && (
          <a href={`/billet/${t.token}/pdf`} className="text-sm font-semibold underline">
            Télécharger le PDF
          </a>
        )}
        <Link href="/supporters/espace" className="text-sm underline">
          Tous mes billets
        </Link>
      </div>
    </PublicShell>
  );
}
