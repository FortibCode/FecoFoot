import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { scopedClubOptions } from "@/lib/queries/reference";
import { renewalCandidates } from "@/lib/queries/renewal";
import { renewLicenses } from "./actions";
import { RenewalForm } from "./RenewalForm";

export const metadata: Metadata = { title: "Renouvellement des licences — FECOFOOT" };

/** Renouvellement groupé des licences d'un club (EF-LIC-10). */
export default async function RenewalPage({ searchParams }: PageProps<"/admin/licences/renouvellement">) {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const clubs = await scopedClubOptions(user);
  const raw = (await searchParams).club;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw) || undefined;
  const clubId = clubs.length === 1 ? clubs[0].id : clubs.find((c) => c.id === requested)?.id;
  const season = seasonOf();
  const rows = clubId ? await renewalCandidates(clubId, season) : [];

  return (
    <>
      <PageHeader
        eyebrow="Licences"
        title={`Renouvellement ${seasonLabel(season)}`}
        description={`Joueurs licenciés en ${seasonLabel(season - 1)} sans licence pour la nouvelle saison. Chaque demande suit ensuite le circuit habituel (encaissement, validation).`}
      />
      {clubs.length > 1 && (
        <form className="mb-6 flex items-end gap-2 text-sm">
          <SelectField label="Club" name="club" defaultValue={clubId ?? ""}>
            <option value="">— Choisir —</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="admin-btn admin-btn-outline">
            Afficher
          </button>
        </form>
      )}
      {clubId && (
        // Toujours affiché : le compte rendu du dernier renouvellement reste visible quand la liste se vide.
        <RenewalForm
          action={renewLicenses.bind(null, clubId)}
          rows={rows.map((r) => ({ playerId: r.playerId, name: `${r.lastName} ${r.firstName}`, federalId: r.federalId, previousNumber: r.previousNumber, category: r.category }))}
        />
      )}
      <Link href="/admin/licences" className="mt-6 inline-block text-sm underline">
        Retour aux licences
      </Link>
    </>
  );
}
