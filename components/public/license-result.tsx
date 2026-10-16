import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, LICENSE_TYPE_LABELS, seasonLabel } from "@/lib/licenses";
import type { PublicLicense } from "@/lib/queries/verify";

const VERDICT = {
  VALIDATED: { text: "Licence valide", cls: "border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_10%,transparent)]" },
  SUSPENDED: { text: "Licence suspendue", cls: "border-destructive bg-destructive/10" },
  EXPIRED: { text: "Licence expirée", cls: "border-destructive bg-destructive/10" },
  TRANSFERRED: { text: "Licence close (transfert du joueur)", cls: "border-destructive bg-destructive/10" },
} as const;

export function LicenseResult({ license }: { license: PublicLicense | null }) {
  // Une demande non validée (en attente, rejetée) n'est pas une licence : elle n'est pas révélée publiquement.
  if (!license || !(license.status in VERDICT)) {
    return <p className="rounded-lg border border-destructive bg-destructive/10 p-4 font-semibold">Aucune licence trouvée.</p>;
  }
  const v = VERDICT[license.status as keyof typeof VERDICT];
  return (
    <div className={`rounded-lg border-2 p-4 ${v.cls}`}>
      <p className="text-lg font-bold">{v.text}</p>
      <p className="mt-2 text-xl font-extrabold uppercase">
        {license.lastName} <span className="font-semibold normal-case">{license.firstName}</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-muted-foreground">Club</dt><dd className="font-medium">{license.club}</dd></div>
        <div><dt className="text-muted-foreground">Saison</dt><dd className="font-medium">{seasonLabel(license.season)}</dd></div>
        <div><dt className="text-muted-foreground">Catégorie</dt><dd className="font-medium">{CATEGORY_LABELS[license.category]}</dd></div>
        <div><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{LICENSE_TYPE_LABELS[license.type]}</dd></div>
        <div><dt className="text-muted-foreground">N° de licence</dt><dd className="font-mono">{license.number}</dd></div>
        <div><dt className="text-muted-foreground">Valable jusqu&apos;au</dt><dd className="font-medium">{formatDate(license.expiresAt)}</dd></div>
      </dl>
    </div>
  );
}
