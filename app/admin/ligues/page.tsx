import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, leagues } from "@/lib/db/schema";
import { updateLeague } from "./actions";
import { LeagueForm } from "./LeagueForm";

export const metadata: Metadata = { title: "Ligues — FECOFOOT" };

export default async function LeaguesPage() {
  await requirePermission("leagues.manage");

  const rows = await db
    .select({
      id: leagues.id,
      code: leagues.code,
      name: leagues.name,
      president: leagues.president,
      email: leagues.email,
      phone: leagues.phone,
      clubCount: count(clubs.id),
    })
    .from(leagues)
    .leftJoin(clubs, eq(clubs.leagueId, leagues.id))
    .groupBy(leagues.id)
    .orderBy(asc(leagues.name));

  return (
    <>
      <PageHeader eyebrow="Organisation" title="Ligues départementales" description={`${rows.length} ligues`} />
      <ul className="flex flex-col gap-4">
        {rows.map((l) => (
          <li key={l.id} className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                <span className="mr-2 font-mono text-xs text-muted-foreground">{l.code}</span>
                {l.name}
              </h2>
              <Link href={`/admin/clubs?league=${l.id}`} className="text-sm underline-offset-2 hover:underline">
                {l.clubCount} club(s)
              </Link>
            </div>
            <LeagueForm action={updateLeague.bind(null, l.id)} initial={l} />
          </li>
        ))}
      </ul>
    </>
  );
}
