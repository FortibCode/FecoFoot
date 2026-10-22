import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { matches, matchOfficials, referees } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { homeClub, awayClub } from "@/lib/queries/competitions";
import { leagueOptions, nationalDivisionOptions } from "@/lib/queries/reference";
import { OFFICIAL_ROLE_LABELS } from "@/lib/referees";
import { openRefereeAccess, updateReferee } from "../actions";
import { RefereeForm } from "../RefereeForm";

export const metadata: Metadata = { title: "Arbitre — FECOFOOT" };

export default async function RefereePage({ params }: PageProps<"/admin/arbitres/[id]">) {
  await requirePermission("refereeing.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [ref] = await db.select().from(referees).where(eq(referees.id, id)).limit(1);
  if (!ref) notFound();
  const [allLeagues, divisions, designations] = await Promise.all([
    leagueOptions(),
    nationalDivisionOptions(),
    db
      .select({ o: matchOfficials, kickoffAt: matches.kickoffAt, home: homeClub.name, away: awayClub.name })
      .from(matchOfficials)
      .innerJoin(matches, eq(matchOfficials.matchId, matches.id))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(eq(matchOfficials.refereeId, id))
      .orderBy(desc(matches.kickoffAt))
      .limit(50),
  ]);

  return (
    <>
      <PageHeader eyebrow="Arbitrage" title={`${ref.lastName} ${ref.firstName}`} />
      <div className="flex flex-col gap-10">
        <div id="modifier">
        <RefereeForm action={updateReferee.bind(null, id)} leagues={allLeagues} divisions={divisions} initial={ref} submitLabel="Enregistrer" />
        </div>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Espace personnel</h2>
          {ref.userId ? (
            <p className="text-sm">Accès ouvert : l&apos;arbitre consulte ses désignations et dépose ses rapports en ligne.</p>
          ) : (
            <ActionForm action={openRefereeAccess.bind(null, id)} label="Ouvrir l'accès à l'espace arbitre" />
          )}
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Désignations</h2>
          {designations.length === 0 ? (
            <EmptyState icon="whistle" title="Aucune désignation" compact />
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {designations.map(({ o, kickoffAt, home, away }) => (
                <li key={o.id} className="flex justify-between gap-2 px-3 py-2">
                  <Link href={`/admin/matchs/${o.matchId}`} className="underline-offset-2 hover:underline">
                    {home} – {away}
                  </Link>
                  <span className="text-muted-foreground">
                    {OFFICIAL_ROLE_LABELS[o.role]} · {formatDateTime(kickoffAt)} {o.report ? "· rapport reçu" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
