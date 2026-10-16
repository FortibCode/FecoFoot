import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { scopedClubOptions } from "@/lib/queries/reference";
import { createPlayer } from "../actions";
import { PlayerForm } from "../PlayerForms";

export const metadata: Metadata = { title: "Nouveau joueur — FECOFOOT" };

export default async function NewPlayerPage() {
  const user = await requirePermission("players.manage");
  const clubs = await scopedClubOptions(user);

  return (
    <>
      <PageHeader
        eyebrow="Licences · Joueurs"
        title="Enregistrer un joueur"
        description="L'identifiant fédéral est attribué automatiquement. Un joueur déjà enregistré (même nom, prénom et date de naissance) est refusé."
      />
      <PlayerForm action={createPlayer} clubs={clubs} submitLabel="Enregistrer le joueur" />
    </>
  );
}
