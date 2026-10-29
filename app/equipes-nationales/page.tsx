import type { Metadata } from "next";
import { connection } from "next/server";
import { NationalTeamCards } from "@/components/public/national-team-cards";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";
import { NATIONAL_TEAMS } from "@/lib/national-teams";

export const metadata: Metadata = { title: "Équipes nationales — FECOFOOT", description: "Les sélections nationales du Congo : staff, convocations, calendrier et résultats." };

export default async function PublicNationalTeamsPage() {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  // Ordre officiel des sélections (équipe A d'abord), même présentation que sur l'accueil.
  const order = NATIONAL_TEAMS.map((t) => t.code as string);
  const teams = (await db.select().from(nationalTeams)).sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  return (
    <PublicShell eyebrow="Équipes nationales" title="Les Diables Rouges" subtitle={`${teams.length} sélections nationales : staff, convocations, calendrier, résultats et photos`} wide>
      <NationalTeamCards teams={teams} />
    </PublicShell>
  );
}
