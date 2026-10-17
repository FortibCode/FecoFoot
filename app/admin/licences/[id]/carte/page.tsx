import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { requireAnyPermission } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, effectiveStatus, LICENSE_TYPE_LABELS, POSITION_LABELS, seasonLabel } from "@/lib/licenses";
import { appUrl, qrSvg } from "@/lib/qr";
import { latestDocuments } from "@/lib/queries/documents";
import { loadLicenseFor } from "@/lib/queries/players";

export const metadata: Metadata = { title: "Carte de licence — FECOFOOT" };

/** Carte de licence imprimable, format carte bancaire (85,6 × 54 mm), avec QR code de vérification (EF-LIC-07). */
export default async function LicenseCardPage({ params }: PageProps<"/admin/licences/[id]/carte">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const row = await loadLicenseFor(user, id);
  if (!row) notFound();
  const { license, player, club } = row;

  if (effectiveStatus(license.status, license.expiresAt) !== "VALIDATED") {
    return <p className="text-sm text-muted-foreground">La carte n’est disponible que pour une licence validée.</p>;
  }
  const [qr, docs] = await Promise.all([
    qrSvg(await appUrl(`/verifier/${license.verifyToken}`)),
    latestDocuments("player", player.id),
  ]);
  const photo = docs.PLAYER_PHOTO;

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <article
        className="relative flex overflow-hidden rounded-lg border bg-white text-black shadow-sm print:shadow-none"
        style={{ width: "85.6mm", height: "54mm" }}
        aria-label="Carte de licence"
      >
        <div className="w-[3mm] shrink-0 bg-[linear-gradient(180deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
        <div className="flex flex-1 flex-col p-[3mm] text-[2.3mm] leading-tight">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-[1.5mm]">
              <BrandLogo size={30} decorative className="size-[8mm]" />
              <div>
              <p className="text-[3.2mm] font-extrabold">FECOFOOT</p>
              <p className="text-[1.6mm] uppercase tracking-wider">Fédération Congolaise de Football</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[1.6mm] uppercase">Licence {LICENSE_TYPE_LABELS[license.type].toLowerCase()}</p>
              <p className="text-[2.8mm] font-bold">{seasonLabel(license.season)}</p>
            </div>
          </div>

          <div className="mt-[2mm] flex flex-1 gap-[2.5mm]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par une route authentifiée
              <img src={`/admin/documents/${photo.id}`} alt={`Photo de ${player.firstName} ${player.lastName}`} className="h-[22mm] w-[17mm] shrink-0 border object-cover" />
            ) : (
              <div className="flex h-[22mm] w-[17mm] shrink-0 items-center justify-center border text-[1.8mm] text-gray-400">PHOTO</div>
            )}
            <div className="flex-1">
              <p className="text-[3.4mm] font-extrabold uppercase">{player.lastName}</p>
              <p className="text-[2.6mm]">{player.firstName}</p>
              <dl className="mt-[1.5mm] grid grid-cols-2 gap-x-[2mm] gap-y-[0.8mm] text-[1.9mm]">
                <div><dt className="text-gray-500 uppercase">Né(e) le</dt><dd className="font-semibold">{formatDate(player.birthDate)}</dd></div>
                <div><dt className="text-gray-500 uppercase">Catégorie</dt><dd className="font-semibold">{CATEGORY_LABELS[license.category]}</dd></div>
                <div><dt className="text-gray-500 uppercase">Club</dt><dd className="font-semibold">{club.shortName ?? club.name}</dd></div>
                <div><dt className="text-gray-500 uppercase">Poste</dt><dd className="font-semibold">{player.position ? POSITION_LABELS[player.position] : "—"}</dd></div>
                <div><dt className="text-gray-500 uppercase">N° licence</dt><dd className="font-mono font-semibold">{license.number}</dd></div>
                <div><dt className="text-gray-500 uppercase">Validité</dt><dd className="font-semibold">{formatDate(license.expiresAt)}</dd></div>
              </dl>
            </div>
            <div className="flex w-[17mm] shrink-0 flex-col items-center justify-end">
              <div className="h-[16mm] w-[16mm] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-[0.5mm] text-[1.4mm] text-gray-500">Vérifier</p>
            </div>
          </div>
          <p className="text-[1.5mm] text-gray-500">ID fédéral {player.federalId}</p>
        </div>
      </article>
    </div>
  );
}
