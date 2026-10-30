import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format";
import { siteSettingsRow } from "@/lib/queries/reference";
import { updateSiteSettings } from "./actions";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Paramètres du site — FECOFOOT" };

/** Paramètres du portail public : informations de la fédération et réseaux sociaux officiels (M14). */
export default async function AdminSettingsPage() {
  await requirePermission("communication.manage");
  const s = await siteSettingsRow();
  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Paramètres du site"
        description={`Informations de la page « La Fédération » et comptes officiels du pied de page.${s?.updatedAt ? ` Dernière modification le ${formatDate(s.updatedAt)}.` : ""}`}
      />
      <SettingsForm
        action={updateSiteSettings}
        values={{
          foundedYear: s?.foundedYear ?? null,
          headquarters: s?.headquarters ?? null,
          affiliations: s?.affiliations ?? null,
          facebook: s?.facebookUrl ?? null,
          instagram: s?.instagramUrl ?? null,
          x: s?.xUrl ?? null,
          youtube: s?.youtubeUrl ?? null,
        }}
      />
    </>
  );
}
