import type { Metadata } from "next";
import { and, asc, eq, gte, inArray, isNull, or, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MatchLine } from "@/components/competitions/match-line";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { matches, matchOfficials } from "@/lib/db/schema";
import { daysAgo } from "@/lib/format";
import { matchQuery, refereeOf } from "@/lib/queries/competitions";

export const metadata: Metadata = { title: "Matchs — FECOFOOT" };

/** Matchs à venir selon le profil : tous (fédération, arbitrage), ceux du club, ou ceux où l'on est désigné. */
export default async function MatchesPage() {
  const user = await requireUser();
  const filters: SQL[] = [or(isNull(matches.kickoffAt), gte(matches.kickoffAt, daysAgo(7)))!];

  if (can(user.role, "lineups.submit")) {
    filters.push(or(eq(matches.homeClubId, user.clubId ?? -1), eq(matches.awayClubId, user.clubId ?? -1))!);
  } else if (can(user.role, "referee.self")) {
    const ref = await refereeOf(user);
    const mine = ref ? (await db.select({ id: matchOfficials.matchId }).from(matchOfficials).where(eq(matchOfficials.refereeId, ref.id))).map((r) => r.id) : [];
    filters.push(inArray(matches.id, mine.length ? mine : [-1]));
  } else if (!can(user.role, "competitions.manage") && !can(user.role, "refereeing.manage")) {
    redirect("/admin/acces-refuse");
  }

  const rows = await matchQuery()
    .where(and(...filters))
    .orderBy(asc(matches.kickoffAt), asc(matches.id))
    .limit(200);

  return (
    <>
      <PageHeader eyebrow="Sport" title="Matchs" description="Matchs de la semaine écoulée et à venir." />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun match.</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-lg border">
          {rows.map((r) => (
            <div key={r.match.id}>
              <p className="px-3 pt-2 text-xs text-muted-foreground">{r.competition.name}</p>
              <MatchLine row={r} href={`/admin/matchs/${r.match.id}`} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
