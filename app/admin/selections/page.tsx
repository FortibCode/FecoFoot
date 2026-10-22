import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalFixtures, nationalStaff, nationalTeams, photos, selections } from "@/lib/db/schema";
import { formatMatchDate } from "@/lib/format";

export const metadata: Metadata = { title: "Équipes nationales — FECOFOOT" };

/** Les six sélections nationales (EF-SEL-01) : staff, listes, prochain match, photos. */
export default async function NationalTeamsPage() {
  await requirePermission("national_teams.manage");
  const [teams, staff, lists, pics, next] = await Promise.all([
    db.select().from(nationalTeams).orderBy(asc(nationalTeams.id)),
    db.select({ teamId: nationalStaff.teamId, n: count() }).from(nationalStaff).groupBy(nationalStaff.teamId),
    db
      .select({ teamId: selections.teamId, n: count(), published: sql<number>`count(*) filter (where ${selections.status} = 'PUBLISHED')::int` })
      .from(selections)
      .groupBy(selections.teamId),
    db.select({ teamId: photos.teamId, n: count() }).from(photos).where(eq(photos.published, true)).groupBy(photos.teamId),
    db
      .selectDistinctOn([nationalFixtures.teamId], { teamId: nationalFixtures.teamId, f: nationalFixtures })
      .from(nationalFixtures)
      .where(and(eq(nationalFixtures.status, "SCHEDULED"), gte(nationalFixtures.kickoffAt, sql`now() - interval '3 hours'`)))
      .orderBy(nationalFixtures.teamId, asc(nationalFixtures.kickoffAt)),
  ]);
  const by = <T extends { teamId: number | null }>(rows: T[], id: number) => rows.find((r) => r.teamId === id);

  return (
    <>
      <PageHeader eyebrow="Sport" title="Équipes nationales" description="Staff technique, listes de convoqués, calendrier et photos des six sélections." />
      <StatCards
        stats={[
          { label: "Sélections", value: teams.length },
          { label: "Membres du staff", value: staff.reduce((a, r) => a + r.n, 0) },
          { label: "Listes publiées", value: lists.reduce((a, r) => a + r.published, 0) },
          { label: "Matchs à venir", value: next.length, sub: "sélections avec un match programmé" },
        ]}
      />
      <ul className="team-cards">
        {teams.map((t) => {
          const f = by(next, t.id)?.f;
          return (
            <li key={t.id}>
              <Link href={`/admin/selections/${t.code}`} className="team-card">
                <span className="team-card-flag" aria-hidden />
                <span className="team-card-head">
                  <span className="team-card-name">{t.name}</span>
                  <span className="team-card-arrow" aria-hidden>
                    →
                  </span>
                </span>
                <span className="team-card-metrics">
                  <span>
                    <strong>{by(staff, t.id)?.n ?? 0}</strong> staff
                  </span>
                  <span>
                    <strong>{by(lists, t.id)?.n ?? 0}</strong> liste(s)
                  </span>
                  <span>
                    <strong>{by(pics, t.id)?.n ?? 0}</strong> photo(s)
                  </span>
                </span>
                <span className={`team-card-next${f ? "" : " is-empty"}`}>
                  {f ? (
                    <>
                      <span className="team-card-next-label">Prochain match</span>
                      {f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`} · {formatMatchDate(f.kickoffAt)}
                    </>
                  ) : (
                    "Aucun match programmé"
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
