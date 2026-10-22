import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { createLeague } from "../actions";
import { LeagueForm } from "../LeagueForm";

export const metadata: Metadata = { title: "Nouvelle ligue — FECOFOOT" };

export default async function NewLeaguePage() {
  await requirePermission("leagues.manage");
  return (
    <>
      <PageHeader
        eyebrow="Organisation · Ligues"
        title="Nouvelle ligue"
        description="Le code court (ex. BZV) identifie la ligue dans les listes, les exports et les numéros de club."
        actions={
          <Link href="/admin/ligues" className="admin-btn admin-btn-outline">
            ← Toutes les ligues
          </Link>
        }
      />
      <section className="flex flex-col gap-4">
        <h2>Informations de la ligue</h2>
        <LeagueForm action={createLeague} submitLabel="Créer la ligue" />
      </section>
    </>
  );
}
