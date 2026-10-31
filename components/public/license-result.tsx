import type { ReactNode } from "react";
import { CalendarIcon, CheckCircleIcon, CloseIcon, IdCardIcon, ShieldIcon, UserIcon } from "@/components/public/icons";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, LICENSE_TYPE_LABELS, seasonLabel } from "@/lib/licenses";
import type { PublicLicense } from "@/lib/queries/verify";

const VERDICT = {
  VALIDATED: { text: "Licence valide", ok: true },
  SUSPENDED: { text: "Licence suspendue", ok: false },
  REVOKED: { text: "Licence révoquée", ok: false },
  EXPIRED: { text: "Licence expirée", ok: false },
  TRANSFERRED: { text: "Licence close (transfert du joueur)", ok: false },
} as const;

/** Résultat d'une vérification : verdict en grand (vert ou rouge), puis identité et informations de la licence. */
export function LicenseResult({ license }: { license: PublicLicense | null }) {
  // Une demande non validée (en attente, rejetée) n'est pas une licence : elle n'est pas révélée publiquement.
  if (!license || !(license.status in VERDICT)) {
    return (
      <div role="status" data-reveal="up" className="flex items-start gap-4 border-l-4 border-[var(--flag-red)] bg-[color-mix(in_srgb,var(--flag-red)_8%,transparent)] p-5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--flag-red)] text-white">
          <CloseIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-bold">Aucune licence trouvée.</p>
          <p className="text-sm text-muted-foreground">Vérifiez le numéro (ex. LIC-2026-000001) ou scannez le QR code de la carte de licence.</p>
        </div>
      </div>
    );
  }
  const v = VERDICT[license.status as keyof typeof VERDICT];
  const facts: [string, ReactNode, ReactNode][] = [
    ["Club", license.club, <ShieldIcon key="c" className="size-4" />],
    ["Saison", seasonLabel(license.season), <CalendarIcon key="s" className="size-4" />],
    ["Catégorie", CATEGORY_LABELS[license.category], <UserIcon key="cat" className="size-4" />],
    ["Type", LICENSE_TYPE_LABELS[license.type], <IdCardIcon key="t" className="size-4" />],
    ["N° de licence", <span key="n" className="font-mono">{license.number}</span>, <IdCardIcon key="n" className="size-4" />],
    ["Valable jusqu'au", formatDate(license.expiresAt), <CalendarIcon key="e" className="size-4" />],
  ];
  return (
    <article aria-label="Résultat de la vérification" data-reveal="up" className="overflow-hidden bg-muted/60">
      {/* Verdict */}
      <div role="status" className={`flex items-center gap-4 px-5 py-4 text-white ${v.ok ? "bg-[var(--flag-green)]" : "bg-[var(--flag-red)]"}`}>
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20">
          {v.ok ? <CheckCircleIcon className="size-6" /> : <CloseIcon className="size-6" />}
        </span>
        <p className="font-display text-2xl leading-tight font-bold uppercase">{v.text}</p>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        {license.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo publiée avec l'accord du joueur
          <img src={license.photoUrl} alt={`Photo de ${license.firstName} ${license.lastName}`} className="h-36 w-28 shrink-0 object-cover" />
        ) : (
          <span aria-hidden className="grid h-36 w-28 shrink-0 place-items-center bg-card text-muted-foreground">
            <UserIcon className="size-10" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="font-display text-3xl leading-none font-bold uppercase">{license.lastName}</p>
            <p className="mt-1 text-lg">{license.firstName}</p>
            {license.identityVerified && (
              <p className="mt-2 inline-flex items-center gap-1.5 bg-[color-mix(in_srgb,var(--flag-green)_12%,transparent)] px-2.5 py-1 text-sm font-semibold text-[var(--flag-green)]">
                <CheckCircleIcon className="size-4" />
                Identité contrôlée {license.identityVerified === "BIOMETRIC" ? "par biométrie" : "sur pièces"} par la fédération
              </p>
            )}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {facts.map(([k, val, icon]) => (
              <div key={k} className="flex items-start gap-2.5 bg-card px-3 py-2.5">
                <span aria-hidden className="mt-0.5 text-[var(--flag-green)]">
                  {icon}
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{val}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </article>
  );
}
