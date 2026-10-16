import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Équipes nationales — FECOFOOT" };

/** Les six sélections nationales (EF-SEL-01). */
export default async function NationalTeamsPage() {
  await requirePermission("national_teams.manage");
  const teams = await db.select().from(nationalTeams).orderBy(asc(nationalTeams.id));
  return (
    <>
      <PageHeader eyebrow="Sport" title="Équipes nationales" description="Staff, calendrier, listes de convoqués." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/selections/${t.code}`} className="block rounded-lg border p-4 hover:bg-muted">
              <p className="font-semibold">{t.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
