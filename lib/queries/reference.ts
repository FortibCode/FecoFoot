import "server-only";
import { asc, eq } from "drizzle-orm";
import { divisionName } from "@/lib/competitions";
import { db } from "@/lib/db";
import { championships, clubs, leagues } from "@/lib/db/schema";

/** Listes de référence pour les formulaires (ligues, clubs). */

export async function leagueOptions() {
  return db.select({ id: leagues.id, name: leagues.name }).from(leagues).orderBy(asc(leagues.name));
}

/** Divisions nationales (Ligue 1, Ligue 2…), nommées comme dans le module Ligues : « Ligue 1 National ». */
export async function nationalDivisionOptions() {
  const rows = await db.select({ id: championships.id, name: championships.name }).from(championships).orderBy(asc(championships.tier));
  return rows.map((c) => ({ id: c.id, name: divisionName(c.name) }));
}

/** Ligues actives : seules à recevoir de nouveaux clubs ou de nouvelles compétitions. */
export async function activeLeagueOptions() {
  return db.select({ id: leagues.id, name: leagues.name }).from(leagues).where(eq(leagues.active, true)).orderBy(asc(leagues.name));
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

/**
 * Divisions nationales du menu et du pied de page du portail, avec le nom saisi dans le module
 * Championnats. Base injoignable : les adresses restent valables, avec un nom générique.
 */
export async function publicDivisions(): Promise<{ code: string; name: string }[]> {
  try {
    return await db.select({ code: championships.code, name: championships.name }).from(championships).where(eq(championships.active, true)).orderBy(asc(championships.tier));
  } catch {
    return [
      { code: "ligue-1", name: "Ligue 1" },
      { code: "ligue-2", name: "Ligue 2" },
    ];
  }
}
