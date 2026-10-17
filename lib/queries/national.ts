import "server-only";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, nationalFixtures, nationalStaff, nationalTeams, players, selectionPlayers, selections } from "@/lib/db/schema";

/** Liste de convoqués avec le club (national ou étranger) de chaque joueur. */
export async function calledPlayers(selectionId: number) {
  const rows = await db
    .select({
      entry: selectionPlayers,
      lastName: players.lastName,
      firstName: players.firstName,
      federalId: players.federalId,
      clubId: clubs.id,
      club: clubs.name,
      clubEmail: clubs.email,
    })
    .from(selectionPlayers)
    .leftJoin(players, eq(selectionPlayers.playerId, players.id))
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(selectionPlayers.selectionId, selectionId))
    .orderBy(asc(selectionPlayers.position), asc(selectionPlayers.shirtNumber), asc(selectionPlayers.id));
  return rows.map((r) => ({
    id: r.entry.id,
    name: r.entry.playerId ? `${r.firstName} ${r.lastName}` : (r.entry.externalName ?? ""),
    federalId: r.federalId,
    // Joueur hors registre : club seul s'il évolue au Congo, « club (pays) » sinon.
    club: r.entry.playerId
      ? (r.club ?? "—")
      : !r.entry.externalCountry || r.entry.externalCountry === "Congo"
        ? (r.entry.externalClub ?? "—")
        : `${r.entry.externalClub} (${r.entry.externalCountry})`,
    // Club national à qui adresser la lettre de convocation (EF-SEL-05) ; null pour un joueur de l'étranger.
    homeClub: r.entry.playerId && r.clubId ? { id: r.clubId, name: r.club ?? "", email: r.clubEmail } : null,
    abroad: !r.entry.playerId,
    position: r.entry.position,
    shirtNumber: r.entry.shirtNumber,
    playerId: r.entry.playerId,
  }));
}

export async function teamPage(code: string, { publishedOnly }: { publishedOnly: boolean }) {
  const [team] = await db
    .select()
    .from(nationalTeams)
    .where(eq(nationalTeams.code, code as (typeof nationalTeams.$inferSelect)["code"]))
    .limit(1);
  if (!team) return null;
  const [staff, fixtures, lists] = await Promise.all([
    db.select().from(nationalStaff).where(eq(nationalStaff.teamId, team.id)).orderBy(asc(nationalStaff.sortOrder), asc(nationalStaff.id)),
    db.select().from(nationalFixtures).where(eq(nationalFixtures.teamId, team.id)).orderBy(desc(nationalFixtures.kickoffAt)),
    db.select().from(selections).where(eq(selections.teamId, team.id)).orderBy(desc(selections.createdAt)),
  ]);
  return { team, staff, fixtures, selections: publishedOnly ? lists.filter((s) => s.status === "PUBLISHED") : lists };
}

/** Derniers résultats et prochains matchs des sélections, pour la page d'accueil. */
export async function nationalFixturesOverview(limit = 3) {
  const cols = { f: nationalFixtures, team: nationalTeams.name, teamSlug: nationalTeams.slug };
  const [played, upcoming] = await Promise.all([
    db.select(cols).from(nationalFixtures).innerJoin(nationalTeams, eq(nationalFixtures.teamId, nationalTeams.id)).where(eq(nationalFixtures.status, "PLAYED")).orderBy(desc(nationalFixtures.kickoffAt)).limit(limit),
    db
      .select(cols)
      .from(nationalFixtures)
      .innerJoin(nationalTeams, eq(nationalFixtures.teamId, nationalTeams.id))
      .where(and(eq(nationalFixtures.status, "SCHEDULED"), gte(nationalFixtures.kickoffAt, new Date(Date.now() - 3 * 3600_000))))
      .orderBy(asc(nationalFixtures.kickoffAt))
      .limit(limit),
  ]);
  return { played, upcoming };
}
