import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { leagues, referees } from "@/lib/db/schema";
import { leagueOptions } from "@/lib/queries/reference";
import { REFEREE_GRADE_LABELS } from "@/lib/referees";
import { createReferee } from "./actions";
import { RefereeForm } from "./RefereeForm";

export const metadata: Metadata = { title: "Arbitres — FECOFOOT" };

/** Registre des arbitres (EF-ARB-01). */
export default async function RefereesPage() {
  await requirePermission("refereeing.manage");
  const [rows, allLeagues] = await Promise.all([
    db
      .select({ r: referees, league: leagues.name })
      .from(referees)
      .leftJoin(leagues, eq(referees.leagueId, leagues.id))
      .orderBy(asc(referees.lastName), asc(referees.firstName)),
    leagueOptions(),
  ]);
  return (
    <>
      <PageHeader eyebrow="Arbitrage" title="Arbitres" description={`${rows.length} officiel(s). Les désignations se font depuis la page de chaque match.`} />
      <DataTable head={["Nom", "Grade", "Ligue", "Contact", "État"]}>
        {rows.map(({ r, league }) => (
          <tr key={r.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/arbitres/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                {r.lastName} {r.firstName}
              </Link>
            </td>
            <td className="px-3 py-2">{REFEREE_GRADE_LABELS[r.grade]}</td>
            <td className="px-3 py-2">{league ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
            <td className="px-3 py-2">{r.active ? "Actif" : "Inactif"}</td>
          </tr>
        ))}
      </DataTable>
      <h2 className="mt-8 mb-3 font-semibold">Ajouter un officiel</h2>
      <RefereeForm action={createReferee} leagues={allLeagues} submitLabel="Ajouter" />
    </>
  );
}
