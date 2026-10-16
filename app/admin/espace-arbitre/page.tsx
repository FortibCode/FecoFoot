import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { competitions, matches, matchOfficials } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { awayClub, homeClub, refereeOf } from "@/lib/queries/competitions";
import { OFFICIAL_ROLE_LABELS, REFEREE_GRADE_LABELS } from "@/lib/referees";
import { submitOfficialReport } from "../matchs/actions";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Mon espace arbitre — FECOFOOT" };

/** Espace personnel de l'arbitre : désignations et rapports en ligne (EF-ARB-04). */
export default async function RefereeSpacePage() {
  const user = await requirePermission("referee.self");
  const ref = await refereeOf(user);
  if (!ref) return <p className="text-sm text-muted-foreground">Votre compte n&apos;est rattaché à aucune fiche d&apos;arbitre.</p>;

  const rows = await db
    .select({ o: matchOfficials, match: matches, competition: competitions.name, home: homeClub.name, away: awayClub.name })
    .from(matchOfficials)
    .innerJoin(matches, eq(matchOfficials.matchId, matches.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
    .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
    .where(eq(matchOfficials.refereeId, ref.id))
    .orderBy(asc(matches.kickoffAt));

  return (
    <>
      <PageHeader eyebrow="Mon espace arbitre" title={`${ref.firstName} ${ref.lastName}`} description={REFEREE_GRADE_LABELS[ref.grade]} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune désignation pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map(({ o, match, competition, home, away }) => (
            <li key={o.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">{competition}</p>
                <p className="font-semibold">
                  {home} – {away}
                </p>
                <p className="text-sm">
                  {OFFICIAL_ROLE_LABELS[o.role]} · {formatDateTime(match.kickoffAt)}
                  {match.venue && ` · ${match.venue}`}
                </p>
                {o.role === "COMMISSIONER" && (
                  <Link href={`/admin/matchs/${match.id}`} className="mt-1 inline-block text-sm font-medium underline">
                    Remplir la feuille de match
                  </Link>
                )}
              </div>
              <ReportForm action={submitOfficialReport.bind(null, o.id)} initial={o.report} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
