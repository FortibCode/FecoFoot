import type { Metadata } from "next";
import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { matches, stadiums } from "@/lib/db/schema";
import { createStadium, deleteStadium } from "./actions";
import { StadiumForm } from "./StadiumForm";

export const metadata: Metadata = { title: "Stades — FECOFOOT" };

/** Stades : fiche affichée au public sur la page de chaque match qui s'y joue. */
export default async function StadiumsPage() {
  await requirePermission("competitions.manage");
  const rows = await db
    .select({ s: stadiums, used: sql<number>`(select count(*)::int from ${matches} where ${matches.stadiumId} = ${stadiums.id})` })
    .from(stadiums)
    .orderBy(asc(stadiums.city), asc(stadiums.name));

  return (
    <>
      <PageHeader
        eyebrow="Administration · Compétitions"
        title="Stades"
        description="Adresse, capacité, pelouse et présentation de chaque stade. Choisissez le stade lors de la programmation d'un match : sa fiche s'affiche sur la page publique du match."
      />
      <div className="flex flex-col gap-8">
        {rows.length === 0 ? (
          <EmptyState icon="users" title="Aucun stade enregistré" compact>
            Enregistrez le premier stade ci-dessous.
          </EmptyState>
        ) : (
          <DataTable head={["Stade", "Ville", "Capacité", "Pelouse", "Matchs", "État", ""]}>
            {rows.map(({ s, used }) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/admin/stades/${s.id}`} className="underline-offset-2 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{s.city}</td>
                <td className="px-3 py-2 tabular-nums">{s.capacity ? s.capacity.toLocaleString("fr-FR") : "—"}</td>
                <td className="px-3 py-2">{s.surface ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{used}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={s.active ? "ok" : "wait"}>{s.active ? "Actif" : "Désactivé"}</StatusBadge>
                </td>
                <td>
                  <RowActions name={s.name} editHref={`/admin/stades/${s.id}`} onDelete={deleteStadium.bind(null, s.id)} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <section id="ajouter" className="flex flex-col gap-4">
          <h2>Nouveau stade</h2>
          <StadiumForm action={createStadium} submitLabel="Enregistrer le stade" />
        </section>
      </div>
    </>
  );
}
