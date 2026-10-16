import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { leagueOptions } from "@/lib/queries/reference";
import { createClub } from "../actions";
import { ClubForm } from "../ClubForms";

export const metadata: Metadata = { title: "Nouveau club — FECOFOOT" };

export default async function NewClubPage() {
  const user = await requirePermission("clubs.manage");
  const all = await leagueOptions();
  const leagues = user.role === "LEAGUE" ? all.filter((l) => l.id === user.leagueId) : all;

  return (
    <>
      <PageHeader
        eyebrow="Organisation · Clubs"
        title="Nouveau club"
        description="Le numéro d'affiliation est attribué automatiquement. Le club est créé avec le statut « En attente »."
      />
      <ClubForm action={createClub} leagues={leagues} submitLabel="Créer le club" />
    </>
  );
}
