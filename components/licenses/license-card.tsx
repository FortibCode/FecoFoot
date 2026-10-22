import { BrandLogo } from "@/components/brand-logo";
import { ClubLogo } from "@/components/public/club-logo";
import { formatDate } from "@/lib/format";
import {
  CARD_STATUS_LABELS,
  cardStatus,
  CATEGORY_LABELS,
  IDENTITY_METHOD_LABELS,
  LICENSE_TYPE_LABELS,
  POSITION_LABELS,
  seasonLabel,
  type CardStatus,
} from "@/lib/licenses";
import type { LicenseCardData } from "@/lib/queries/license-card";

const STATUS_CLASS: Record<CardStatus, string> = {
  ACTIVE: "bg-[#009543] text-white",
  PENDING: "bg-[#fbde4a] text-[#0a1f15]",
  EXPIRED: "bg-[#dc241f] text-white",
  SUSPENDED: "bg-[#dc241f] text-white",
  REVOKED: "bg-[#0a1f15] text-white",
  CLOSED: "bg-gray-500 text-white",
};

/** Trame guillochée (élément graphique anti-copie, purement visuel). */
function Guilloche() {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]" viewBox="0 0 320 200" preserveAspectRatio="none">
      {lines.map((i) => (
        <path
          key={i}
          d={`M0 ${14 * i + 4} C 40 ${14 * i - 10}, 80 ${14 * i + 18}, 120 ${14 * i + 4} S 200 ${14 * i - 10}, 240 ${14 * i + 4} S 300 ${14 * i + 18}, 320 ${14 * i + 4}`}
          fill="none"
          stroke="#009543"
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

/** Ligne de micro-texte (illisible à la photocopie). */
function MicroText({ className = "" }: { className?: string }) {
  return (
    <p aria-hidden className={`overflow-hidden whitespace-nowrap text-[1.05mm] leading-none tracking-[0.08em] text-[#009543]/70 ${className}`}>
      {"FECOFOOT · RÉPUBLIQUE DU CONGO · LICENCE OFFICIELLE · ".repeat(6)}
    </p>
  );
}

function Face({ label, children, demo }: { label: string; children: React.ReactNode; demo: boolean }) {
  return (
    <article
      aria-label={label}
      className="license-face relative flex overflow-hidden rounded-[3mm] border border-[#d6e3dc] bg-white text-[#0a1f15] shadow-[0_8px_30px_rgba(10,31,21,0.12)]"
      style={{ width: "85.6mm", height: "54mm" }}
    >
      <Guilloche />
      <div aria-hidden className="license-crest pointer-events-none absolute -right-[8mm] -bottom-[10mm] h-[48mm] w-[42mm] opacity-[0.07]" />
      <div className="relative z-[1] w-[2.4mm] shrink-0 bg-[linear-gradient(180deg,#009543_33.3%,#fbde4a_33.3%_66.6%,#dc241f_66.6%)]" />
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">{children}</div>
      {demo && (
        <span aria-label="Carte d'exemple (données de démonstration)" className="pointer-events-none absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-[1mm] border-[0.5mm] border-[#dc241f]/60 px-[3mm] py-[0.5mm] text-[5mm] font-extrabold tracking-[0.3em] text-[#dc241f]/50">
          EXEMPLE
        </span>
      )}
    </article>
  );
}

/**
 * Carte de licence, recto et verso, au format carte bancaire (85,6 × 54 mm).
 * L'indicateur d'identité n'apparaît que si un contrôle a réellement été enregistré (pièces ou biométrie).
 */
export function LicenseCard({ data }: { data: LicenseCardData }) {
  const { license, player, club } = data;
  const status = cardStatus(license.status, license.expiresAt);
  return (
    <div className="license-card-view flex flex-wrap gap-6">
      <Face label="Carte de licence — recto" demo={data.demo}>
        <div className="flex items-start justify-between gap-[2mm] px-[2.6mm] pt-[2.2mm]">
          <div className="flex min-w-0 items-center gap-[1.6mm]">
            <BrandLogo size={30} decorative className="size-[8.5mm] shrink-0" />
            <div className="min-w-0">
              <p className="text-[1.55mm] font-semibold tracking-[0.12em] uppercase">Fédération Congolaise de Football</p>
              <p className="text-[3mm] leading-tight font-extrabold tracking-[0.04em]">LICENCE DE JOUEUR</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[1.5mm] uppercase">Saison</p>
            <p className="text-[2.7mm] leading-none font-extrabold">{seasonLabel(license.season)}</p>
          </div>
        </div>

        <div className="mt-[1.6mm] flex min-h-0 flex-1 gap-[2.4mm] px-[2.6mm]">
          <div className="flex shrink-0 flex-col items-center gap-[0.8mm]">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo servie par une route à accès contrôlé
              <img src={data.photoUrl} alt={`Photo de ${player.firstName} ${player.lastName}`} className="h-[23mm] w-[18mm] rounded-[1mm] border-[0.4mm] border-white object-cover shadow-[0_0_0_0.25mm_#0a1f15]" />
            ) : (
              <div className="flex h-[23mm] w-[18mm] items-center justify-center rounded-[1mm] border border-dashed border-gray-400 text-[1.7mm] text-gray-400">PHOTO</div>
            )}
            {data.identity && (
              <span className="flex items-center gap-[0.5mm] rounded-full bg-[#009543] px-[1.2mm] py-[0.3mm] text-[1.35mm] font-bold text-white">
                <svg viewBox="0 0 24 24" className="size-[1.8mm]" fill="none" stroke="currentColor" strokeWidth={4} aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {data.identity === "BIOMETRIC" ? "Biométrie vérifiée" : "Identité vérifiée"}
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-[3.6mm] leading-tight font-extrabold uppercase">{player.lastName}</p>
            <p className="truncate text-[2.6mm] leading-tight">{player.firstName}</p>
            <dl className="mt-[1.4mm] grid grid-cols-2 gap-x-[2mm] gap-y-[0.9mm] text-[1.85mm] leading-tight">
              {(
                [
                  ["Né(e) le", player.showBirthDate ? formatDate(player.birthDate) : "Non publiée"],
                  ["Nationalité", player.nationality],
                  ["Catégorie", CATEGORY_LABELS[license.category]],
                  ["Poste", player.position ? POSITION_LABELS[player.position] : "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[1.45mm] tracking-[0.06em] text-gray-500 uppercase">{k}</dt>
                  <dd className="truncate font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex items-center gap-[1.2mm] pb-[0.6mm]">
              <ClubLogo src={data.clubLogoUrl} name={club.name} className="size-[5mm] text-[1.5mm]" />
              <span className="min-w-0 truncate text-[2mm] font-bold">{club.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-[2mm] px-[2.6mm] pb-[0.8mm]">
          <span className="font-mono text-[2.1mm] font-bold tracking-[0.04em]">{license.number}</span>
          <span className={`rounded-full px-[1.6mm] py-[0.35mm] text-[1.6mm] font-extrabold tracking-[0.08em] uppercase ${STATUS_CLASS[status]}`}>{CARD_STATUS_LABELS[status]}</span>
        </div>
        <MicroText className="px-[2.6mm] pb-[0.8mm]" />
      </Face>

      <Face label="Carte de licence — verso" demo={data.demo}>
        <div className="flex min-h-0 flex-1 gap-[3mm] px-[3mm] pt-[3mm]">
          <div className="flex shrink-0 flex-col items-center gap-[0.8mm]">
            <div className="size-[24mm] rounded-[1mm] bg-white p-[0.8mm] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: data.qr }} />
            <p className="text-center text-[1.45mm] leading-tight text-gray-600">
              Scannez pour vérifier
              <br />
              l&apos;authenticité
            </p>
          </div>
          <dl className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-[2mm] gap-y-[1.1mm] text-[1.85mm] leading-tight">
            {(
              [
                ["Délivrée le", formatDate(license.validatedAt)],
                ["Expire le", formatDate(license.expiresAt)],
                ["Type", LICENSE_TYPE_LABELS[license.type]],
                ["ID fédéral", player.federalId],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[1.45mm] tracking-[0.06em] text-gray-500 uppercase">{k}</dt>
                <dd className="truncate font-semibold">{v}</dd>
              </div>
            ))}
            <div className="col-span-2 min-w-0">
              <dt className="text-[1.45mm] tracking-[0.06em] text-gray-500 uppercase">Contrôle d&apos;identité</dt>
              <dd className="font-semibold">
                {player.identityVerifiedAt && player.identityMethod
                  ? `Effectué ${IDENTITY_METHOD_LABELS[player.identityMethod]} le ${formatDate(player.identityVerifiedAt)}`
                  : "Non enregistré"}
              </dd>
            </div>
          </dl>
        </div>
        <p className="px-[3mm] pt-[1mm] text-[1.45mm] leading-snug text-gray-600">
          Carte personnelle et incessible, à présenter avec une pièce d&apos;identité. Seul le statut affiché en ligne après lecture du QR code fait foi.
          Document émis par la plateforme FECOFOOT.
        </p>
        <MicroText className="mt-auto px-[3mm] pt-[0.6mm] pb-[0.8mm]" />
      </Face>
    </div>
  );
}
