import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { seasonOf } from "@/lib/licenses";
import { activeLeagueOptions } from "@/lib/queries/reference";
import { createCompetition } from "../actions";
import { CompetitionForm } from "../CompetitionForms";

export const metadata: Metadata = { title: "Nouvelle compétition — FECOFOOT" };

export default async function NewCompetitionPage() {
  const user = await requirePermission("competitions.manage");
  // Un compte de ligue crée les compétitions de sa ligue : pas de choix d'organisateur.
  const leagues = user.role === "LEAGUE" ? null : await activeLeagueOptions();
  return (
    <>
      <PageHeader
        eyebrow="Sport · Compétitions"
        title="Nouvelle compétition"
        description="Championnat départemental ou compétition nationale, coupe, compétition féminine ou de jeunes : le format et le départage se règlent ici."
      />
      <section className="flex flex-col gap-4">
        <h2>Informations et format</h2>
        <CompetitionForm action={createCompetition} season={seasonOf()} leagues={leagues} />
      </section>
    </>
  );
}
