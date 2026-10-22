import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PrintButton } from "@/components/admin/print-button";
import { LicenseCard } from "@/components/licenses/license-card";
import { requireAnyPermission } from "@/lib/auth/guard";
import { cardIssued } from "@/lib/licenses";
import { licenseCardData } from "@/lib/queries/license-card";
import { loadLicenseFor } from "@/lib/queries/players";

export const metadata: Metadata = { title: "Carte de licence — FECOFOOT" };

/**
 * Carte de licence (EF-LIC-07) : aperçu recto/verso, impression (une page au format de la carte par face)
 * et PDF. Délivrée seulement pour une licence validée ; une licence suspendue, révoquée ou expirée l'affiche.
 */
export default async function LicenseCardPage({ params }: PageProps<"/admin/licences/[id]/carte">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const row = await loadLicenseFor(user, id);
  if (!row) notFound();
  if (!cardIssued(row.license.status)) {
    return <p className="text-sm text-muted-foreground">La carte n’est délivrée qu’après la validation de la licence.</p>;
  }
  const data = await licenseCardData(id);
  if (!data) notFound();

  return (
    <div className="flex flex-col items-start gap-6">
      {/* Impression : chaque face sur une page au format de la carte, sans marges (ni en-tête ni pied de page du navigateur). */}
      <style>{`@page { size: 85.6mm 54mm; margin: 0; }`}</style>
      <div className="w-full print:hidden">
        <PageHeader
          eyebrow={`Licences · ${data.license.number}`}
          title={`Carte de ${data.player.firstName} ${data.player.lastName}`}
          description="Aperçu recto et verso. L'impression produit une page par face, au format carte bancaire."
          actions={
            <>
              <Link href={`/admin/licences/${id}`} className="admin-btn admin-btn-outline">
                ← Licence
              </Link>
              <a href={`/admin/licences/${id}/carte/pdf`} className="admin-btn admin-btn-outline">
                Télécharger le PDF
              </a>
              <PrintButton label="Imprimer la carte" />
            </>
          }
        />
      </div>
      <div className="print-only">
        <LicenseCard data={data} />
      </div>
    </div>
  );
}
