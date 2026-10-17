import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { ACCREDITATION_STATUS_LABELS, PRESS_ROLE_LABELS, PRESS_ZONE_LABELS } from "@/lib/accreditations";
import { formatDateTime } from "@/lib/format";
import { accreditationByTracking } from "@/lib/queries/accreditations";

export const metadata: Metadata = { title: "Suivi d'accréditation — FECOFOOT", robots: { index: false } };

/** Suivi de la demande (EF-MED-04). */
export default async function TrackingPage({ params }: PageProps<"/accreditations/suivi/[token]">) {
  const row = await accreditationByTracking((await params).token);
  if (!row) notFound();
  const { acc, event } = row;
  return (
    <PublicShell eyebrow={`Accréditation ${acc.number}`} subtitle={`Accréditation ${acc.number}`} title={ACCREDITATION_STATUS_LABELS[acc.status]}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          {acc.firstName} {acc.lastName} · {acc.outlet} · {PRESS_ROLE_LABELS[acc.role]}
        </p>
        <p>
          {event.title} — {formatDateTime(event.kickoffAt)}
        </p>
        <p>Zones demandées : {acc.requestedZones.map((z) => PRESS_ZONE_LABELS[z]).join(", ")}</p>
        {acc.status === "PENDING" && <p className="text-muted-foreground">Votre demande est en cours de traitement. Conservez ce lien : vous y trouverez votre badge.</p>}
        {acc.status === "REFUSED" && <p className="text-destructive">Motif du refus : {acc.decisionReason}</p>}
        {acc.status === "APPROVED" && (
          <>
            <p>
              Zones accordées : <strong>{(acc.grantedZones ?? []).map((z) => PRESS_ZONE_LABELS[z]).join(", ")}</strong>
            </p>
            <Link href={`/accreditations/badge/${acc.badgeToken}`} className="w-fit rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
              Mon badge
            </Link>
          </>
        )}
      </div>
    </PublicShell>
  );
}
