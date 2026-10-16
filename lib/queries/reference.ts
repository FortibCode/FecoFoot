import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, leagues } from "@/lib/db/schema";

/** Listes de référence pour les formulaires (ligues, clubs). */

export async function leagueOptions() {
  return db.select({ id: leagues.id, name: leagues.name }).from(leagues).orderBy(asc(leagues.name));
}

export async function clubOptions() {
  return db
    .select({ id: clubs.id, name: clubs.name, leagueId: clubs.leagueId })
    .from(clubs)
    .orderBy(asc(clubs.name));
}

export type Option = { id: number; name: string };

/** Clubs sur lesquels l'utilisateur peut agir : le sien (club), ceux de sa ligue (ligue), tous (fédération). */
export async function scopedClubOptions(user: { role: string; leagueId: number | null; clubId: number | null }) {
  const all = await clubOptions();
  if (user.role === "CLUB") return all.filter((c) => c.id === user.clubId);
  if (user.role === "LEAGUE") return all.filter((c) => c.leagueId === user.leagueId);
  return all;
}
