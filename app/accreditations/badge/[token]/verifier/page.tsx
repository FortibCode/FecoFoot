import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { badgeValidity, PRESS_ROLE_LABELS, PRESS_ZONE_LABELS, PRESS_ZONES, pressPhotoUrl } from "@/lib/accreditations";
import { formatDateTime } from "@/lib/format";
import { accreditationByBadge } from "@/lib/queries/accreditations";
import { parseEventTitle } from "@/lib/ticketing";

export const metadata: Metadata = { title: "Vérification d'un badge presse — FECOFOOT", robots: { index: false } };

/**
 * Page ouverte en scannant le QR code d'un badge presse avec un téléphone (steward, service de sécurité) :
 * photo, identité, zones accordées et validité pour le match. Lecture seule : aucune entrée n'est
 * enregistrée (le contrôle d'accès officiel se fait dans l'administration).
 */
export default async function VerifyBadgePage({ params }: PageProps<"/accreditations/badge/[token]/verifier">) {
  const row = await accreditationByBadge((await params).token);
  if (!row) {
    return (
      <PublicShell eyebrow="Accréditation" title="Vérification du badge">
        <div role="alert" className="rounded-2xl border-2 border-destructive bg-destructive/10 p-6">
          <p className="font-heading text-2xl font-bold uppercase text-destructive">Badge inconnu</p>
          <p className="mt-1 text-sm">Ce QR code ne correspond à aucun badge presse délivré par la FECOFOOT.</p>
        </div>
      </PublicShell>
    );
  }
  const { acc, event } = row;
  const { ok, reason } = badgeValidity({ status: acc.status, kickoffAt: event.kickoffAt, eventCancelled: event.salesStatus === "CANCELLED", now: new Date() });
  const photo = acc.status === "APPROVED" ? pressPhotoUrl(acc) : null;
  const { competition, match } = parseEventTitle(event.title);
  const granted = acc.grantedZones ?? [];
  return (
    <PublicShell eyebrow="Accréditation" title="Vérification du badge">
      <div className="flex flex-col gap-5">
        <div role="status" className={`flex items-center gap-4 rounded-2xl border-2 p-5 ${ok ? "border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_10%,transparent)]" : "border-destructive bg-destructive/10"}`}>
          <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-full text-3xl font-bold text-white ${ok ? "bg-[var(--flag-green)]" : "bg-destructive"}`}>
            {ok ? "✓" : "✕"}
          </span>
          <div>
            <p className={`font-heading text-2xl font-bold uppercase ${ok ? "text-[#00753a]" : "text-destructive"}`}>{ok ? "Badge presse valable" : "Badge non valable"}</p>
            <p className="text-sm">{reason}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- photo servie par la route des badges
            <img src={photo} alt={`Photo de ${acc.firstName} ${acc.lastName}`} className="aspect-[3/4] w-24 shrink-0 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0 text-sm">
            <p className="font-heading text-xl font-bold uppercase">{acc.lastName}</p>
            <p>{acc.firstName}</p>
            <p className="mt-1 font-semibold">{acc.outlet}</p>
            <p className="text-muted-foreground">
              {PRESS_ROLE_LABELS[acc.role]} · carte de presse {acc.pressCardNumber}
            </p>
            <p className="mt-1 font-mono text-xs">{acc.number}</p>
          </div>
        </div>
        {acc.status === "APPROVED" && (
          <ul aria-label="Zones d'accès" className="grid gap-2 sm:grid-cols-2">
            {PRESS_ZONES.map((z, i) => (
              <li key={z} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${granted.includes(z) ? "border-[var(--flag-green)] font-semibold" : "text-muted-foreground line-through"}`}>
                <span className={`grid size-7 place-items-center rounded font-heading font-bold ${granted.includes(z) ? "bg-[var(--flag-green)] text-white" : "bg-muted"}`}>{i + 1}</span>
                {PRESS_ZONE_LABELS[z]}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm">
          <strong>{match}</strong>
          {competition && ` — ${competition}`} · {formatDateTime(event.kickoffAt)} · {event.venue}
        </p>
        <p className="text-xs text-muted-foreground">
          Vérification en lecture seule. Comparez la photo au porteur et sa carte de presse ; l&apos;entrée est enregistrée au contrôle d&apos;accès.
        </p>
      </div>
    </PublicShell>
  );
}
