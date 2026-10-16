import "server-only";
import { asc, desc, eq } from "drizzle-orm";
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
    .orderBy(asc(selectionPlayers.position), asc(selectionPlayers.shirtNumber));
  return rows.map((r) => ({
    id: r.entry.id,
    name: r.entry.playerId ? `${r.firstName} ${r.lastName}` : (r.entry.externalName ?? ""),
    federalId: r.federalId,
    club: r.entry.playerId ? (r.club ?? "—") : `${r.entry.externalClub} (${r.entry.externalCountry})`,
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
