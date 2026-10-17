import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { PRESS_ROLE_LABELS, PRESS_ZONE_LABELS } from "@/lib/accreditations";
import { formatDateTime } from "@/lib/format";
import { appUrl, qrSvg } from "@/lib/qr";
import { accreditationByBadge } from "@/lib/queries/accreditations";

export const metadata: Metadata = { title: "Badge presse — FECOFOOT", robots: { index: false } };

/** Badge numérique imprimable (EF-MED-04), valable uniquement pour le match demandé (RG-16). */
export default async function BadgePage({ params }: PageProps<"/accreditations/badge/[token]">) {
  const { token } = await params;
  const row = await accreditationByBadge(token);
  if (!row) notFound();
  const { acc, event } = row;
  if (acc.status !== "APPROVED") return <main className="p-8 text-center font-semibold text-destructive">Badge non valide.</main>;
  const qr = await qrSvg(await appUrl(`/accreditations/badge/${token}`));

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
      <article aria-label="Badge presse" className="w-full max-w-sm overflow-hidden rounded-xl border bg-white text-black">
        <div className="h-2 bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">FECOFOOT · Presse</p>
          <p className="text-2xl font-extrabold uppercase">{acc.lastName}</p>
          <p className="text-lg">{acc.firstName}</p>
          <p className="text-sm">
            {acc.outlet} · {PRESS_ROLE_LABELS[acc.role]}
          </p>
          <div className="my-3 w-44 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-sm font-semibold">{(acc.grantedZones ?? []).map((z) => PRESS_ZONE_LABELS[z]).join(" · ")}</p>
          <p className="text-xs text-gray-600">
            {event.title} — {formatDateTime(event.kickoffAt)}
          </p>
          <p className="font-mono text-xs text-gray-500">{acc.number}</p>
        </div>
      </article>
      <div className="print:hidden">
        <PrintButton label="Imprimer le badge" />
      </div>
    </main>
  );
}
