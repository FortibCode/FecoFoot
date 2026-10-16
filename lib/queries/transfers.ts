import "server-only";
import { eq, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CurrentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, players, transfers } from "@/lib/db/schema";

export const fromClub = alias(clubs, "from_club");
export const toClub = alias(clubs, "to_club");

/**
 * Périmètre : une ligue voit les transferts qui concernent un club de son territoire,
 * un club ceux qui le concernent (départ ou arrivée) ; la fédération voit tout.
 */
export function transferScope(user: CurrentUser): SQL | undefined {
  if (user.role === "LEAGUE") return or(eq(fromClub.leagueId, user.leagueId ?? -1), eq(toClub.leagueId, user.leagueId ?? -1));
  if (user.role === "CLUB") return or(eq(fromClub.id, user.clubId ?? -1), eq(toClub.id, user.clubId ?? -1));
  return undefined;
}

export function transferQuery() {
  return db
    .select({
      transfer: transfers,
      player: { id: players.id, federalId: players.federalId, lastName: players.lastName, firstName: players.firstName },
      fromClub: { id: fromClub.id, name: fromClub.name, leagueId: fromClub.leagueId, email: fromClub.email },
      toClub: { id: toClub.id, name: toClub.name, leagueId: toClub.leagueId },
    })
    .from(transfers)
    .innerJoin(players, eq(transfers.playerId, players.id))
    .leftJoin(fromClub, eq(transfers.fromClubId, fromClub.id))
    .innerJoin(toClub, eq(transfers.toClubId, toClub.id));
}
