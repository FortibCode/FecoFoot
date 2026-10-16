import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Équipes nationales — FECOFOOT", description: "Les sélections nationales du Congo : staff, convocations, calendrier et résultats." };

export default async function PublicNationalTeamsPage() {
  const teams = await db.select().from(nationalTeams).orderBy(asc(nationalTeams.id));
  return (
    <PublicShell eyebrow="Équipes nationales" title="Les Diables Rouges" wide>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <li key={t.id}>
            <Link href={`/equipes-nationales/${t.slug}`} className="block rounded-lg border p-4 font-semibold hover:bg-muted">
              {t.name}
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
