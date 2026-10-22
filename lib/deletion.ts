import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accreditations,
  articles,
  clubs,
  competitionTeams,
  competitions,
  disciplineCases,
  documents,
  leagues,
  licenses,
  matchEvents,
  matchLineups,
  matchOfficials,
  matches,
  playerConsents,
  players,
  referees,
  selectionPlayers,
  ticketEvents,
  ticketOrders,
  transfers,
  users,
} from "@/lib/db/schema";
import { deleteFile } from "@/lib/storage";

/**
 * Suppressions protégées. Les données réglementaires (licences, transferts, feuilles de match,
 * décisions disciplinaires) ne disparaissent jamais : un élément qui y est rattaché ne peut pas
 * être supprimé, et la raison est donnée en clair. Chaque fonction renvoie la liste des blocages
 * (vide = suppression possible).
 */
const exists = async (q: Promise<unknown[]>) => (await q).length > 0;
const one = <T>(q: { limit: (n: number) => Promise<T[]> }) => q.limit(1);

export async function clubBlockers(id: number): Promise<string[]> {
  const checks: [Promise<boolean>, string][] = [
    [exists(one(db.select({ x: players.id }).from(players).where(eq(players.clubId, id)))), "des joueurs y sont enregistrés"],
    [exists(one(db.select({ x: licenses.id }).from(licenses).where(eq(licenses.clubId, id)))), "des licences y sont rattachées"],
    [exists(one(db.select({ x: transfers.id }).from(transfers).where(or(eq(transfers.fromClubId, id), eq(transfers.toClubId, id))))), "il figure dans des transferts"],
    [exists(one(db.select({ x: competitionTeams.id }).from(competitionTeams).where(eq(competitionTeams.clubId, id)))), "il est engagé dans une compétition"],
    [exists(one(db.select({ x: matches.id }).from(matches).where(or(eq(matches.homeClubId, id), eq(matches.awayClubId, id))))), "il a des matchs"],
    [exists(one(db.select({ x: users.id }).from(users).where(eq(users.clubId, id)))), "des comptes de club y sont rattachés"],
    [exists(one(db.select({ x: disciplineCases.id }).from(disciplineCases).where(eq(disciplineCases.clubId, id)))), "il a des dossiers disciplinaires"],
  ];
  const r = await Promise.all(checks.map(([p]) => p));
  return checks.filter((_, i) => r[i]).map(([, why]) => why);
}

export async function deleteClubRecord(id: number) {
  const docs = await db.delete(documents).where(and(eq(documents.ownerType, "club"), eq(documents.ownerId, id))).returning({ key: documents.storageKey });
  await db.delete(clubs).where(eq(clubs.id, id)); // dirigeants : suppression en cascade
  await Promise.all(docs.map((d) => deleteFile(d.key)));
}

export async function playerBlockers(id: number): Promise<string[]> {
  const checks: [Promise<boolean>, string][] = [
    [exists(one(db.select({ x: licenses.id }).from(licenses).where(eq(licenses.playerId, id)))), "il a des licences"],
    [exists(one(db.select({ x: transfers.id }).from(transfers).where(eq(transfers.playerId, id)))), "il figure dans des transferts"],
    [exists(one(db.select({ x: matchEvents.id }).from(matchEvents).where(eq(matchEvents.playerId, id)))), "il apparaît sur des feuilles de match"],
    [exists(one(db.select({ x: matchLineups.id }).from(matchLineups).where(eq(matchLineups.playerId, id)))), "il figure dans des compositions"],
    [exists(one(db.select({ x: selectionPlayers.id }).from(selectionPlayers).where(eq(selectionPlayers.playerId, id)))), "il a été convoqué en sélection"],
    [exists(one(db.select({ x: disciplineCases.id }).from(disciplineCases).where(eq(disciplineCases.playerId, id)))), "il a des dossiers disciplinaires"],
  ];
  const r = await Promise.all(checks.map(([p]) => p));
  return checks.filter((_, i) => r[i]).map(([, why]) => why);
}

export async function deletePlayerRecord(id: number) {
  await db.delete(playerConsents).where(eq(playerConsents.playerId, id));
  const docs = await db.delete(documents).where(and(eq(documents.ownerType, "player"), eq(documents.ownerId, id))).returning({ key: documents.storageKey });
  await db.delete(players).where(eq(players.id, id));
  await Promise.all(docs.map((d) => deleteFile(d.key)));
}

export async function competitionBlockers(id: number): Promise<string[]> {
  const [c] = await db.select({ status: competitions.status }).from(competitions).where(eq(competitions.id, id)).limit(1);
  if (!c) return ["compétition introuvable"];
  const out: string[] = [];
  if (c.status !== "DRAFT") out.push("elle n'est plus en préparation (le calendrier ou les résultats existent)");
  if (await exists(one(db.select({ x: matches.id }).from(matches).where(eq(matches.competitionId, id))))) out.push("des matchs ont été générés");
  if (await exists(one(db.select({ x: disciplineCases.id }).from(disciplineCases).where(eq(disciplineCases.competitionId, id))))) out.push("des dossiers disciplinaires y sont rattachés");
  return out;
}

export const deleteCompetitionRecord = (id: number) => db.delete(competitions).where(eq(competitions.id, id)); // clubs engagés : cascade

export async function refereeBlockers(id: number): Promise<string[]> {
  const out: string[] = [];
  if (await exists(one(db.select({ x: matchOfficials.id }).from(matchOfficials).where(eq(matchOfficials.refereeId, id))))) out.push("il a déjà été désigné sur des matchs");
  return out;
}

export const deleteRefereeRecord = (id: number) => db.delete(referees).where(eq(referees.id, id));

export async function ticketEventBlockers(id: number): Promise<string[]> {
  const out: string[] = [];
  if (await exists(one(db.select({ x: ticketOrders.id }).from(ticketOrders).where(eq(ticketOrders.eventId, id))))) out.push("des billets ont été vendus ou réservés");
  if (await exists(one(db.select({ x: accreditations.id }).from(accreditations).where(eq(accreditations.eventId, id))))) out.push("des demandes d'accréditation existent");
  return out;
}

export const deleteTicketEventRecord = (id: number) => db.delete(ticketEvents).where(eq(ticketEvents.id, id)); // tribunes, quotas : cascade

export async function deleteArticleRecord(id: number) {
  const [a] = await db.delete(articles).where(eq(articles.id, id)).returning({ coverKey: articles.coverKey });
  if (a?.coverKey) await deleteFile(a.coverKey);
  return Boolean(a);
}

/** Message d'erreur lisible : « Suppression impossible : a ; b. » */
export async function leagueBlockers(id: number): Promise<string[]> {
  const checks: [Promise<boolean>, string][] = [
    [exists(one(db.select({ x: clubs.id }).from(clubs).where(eq(clubs.leagueId, id)))), "des clubs y sont rattachés"],
    [exists(one(db.select({ x: users.id }).from(users).where(eq(users.leagueId, id)))), "des comptes de ligue y sont rattachés"],
    [exists(one(db.select({ x: referees.id }).from(referees).where(eq(referees.leagueId, id)))), "des arbitres y sont rattachés"],
    [exists(one(db.select({ x: competitions.id }).from(competitions).where(eq(competitions.leagueId, id)))), "elle organise des compétitions"],
  ];
  const r = await Promise.all(checks.map(([p]) => p));
  return checks.filter((_, i) => r[i]).map(([, why]) => why);
}

export async function deleteLeagueRecord(id: number) {
  await db.delete(leagues).where(eq(leagues.id, id));
}

export const blockedMessage = (what: string, reasons: string[]) =>
  `Suppression impossible : ${reasons.join(" ; ")}. ${what} doit être conservé pour l'historique de la fédération.`;

