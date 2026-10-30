"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { blankToNull, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { canReschedule, EVENT_TYPES, GOAL_EVENTS, lineupError, MATCH_STATUSES, nextPeriod, scoreFromEvents, type LineupEntry, type MatchPeriod } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, matchEvents, matches, matchLineups, matchOfficials, players, referees, stadiums } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/queries/players";
import { canEditMatchSheet, canManageMatch, eligiblePlayers, recomputeMatch, refereeOf } from "@/lib/queries/competitions";
import { suspendedPlayers } from "@/lib/queries/discipline";
import { designationError, matchDay, OFFICIAL_ROLES } from "@/lib/referees";

const matchPath = (id: number) => `/admin/matchs/${id}`;
const OUT_OF_SCOPE: ActionState = { error: "Ce match n'est pas dans votre périmètre." };
const VALIDATED: ActionState = { error: "Résultat validé : seul l'organisateur de la compétition peut le corriger." };

async function loadMatch(matchId: number) {
  const [m] = await db
    .select({ match: matches, competition: competitions })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(matches.id, matchId))
    .limit(1);
  return m ?? null;
}

function revalidateMatch(matchId: number, competitionId: number) {
  revalidatePath(matchPath(matchId));
  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/competitions", "layout");
  revalidatePath("/matchs", "layout");
  revalidatePath("/ligues", "layout");
}

/** Programmation : date, heure, stade (organisateur), avant le coup d'envoi. Les désignations suivent la nouvelle date (RG-08). */
export async function scheduleMatch(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await canManageMatch(user, matchId))) return OUT_OF_SCOPE;
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  if (!canReschedule(m.match.status)) return { error: "Le match a commencé ou est terminé : sa programmation ne peut plus changer." };
  const raw = String(formData.get("kickoffAt") ?? "");
  // Saisie « AAAA-MM-JJTHH:MM » en heure de Brazzaville (UTC+1).
  const kickoffAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00+01:00`) : null;
  if (raw && (!kickoffAt || Number.isNaN(kickoffAt.getTime()))) return { error: "Date et heure invalides." };
  if (kickoffAt && (kickoffAt.getUTCFullYear() < m.competition.season - 1 || kickoffAt.getUTCFullYear() > m.competition.season + 2)) {
    return { error: "La date ne correspond pas à la saison de la compétition." };
  }
  // Stade enregistré : son nom et sa ville font foi ; sinon, lieu saisi librement.
  const stadiumId = Number(formData.get("stadiumId")) || null;
  const [stadium] = stadiumId ? await db.select().from(stadiums).where(eq(stadiums.id, stadiumId)).limit(1) : [];
  if (stadiumId && !stadium) return { error: "Stade introuvable." };
  const venue = stadium ? `${stadium.name}, ${stadium.city}` : z.preprocess(blankToNull, z.string().trim().max(160).nullable()).parse(formData.get("venue"));
  // Un match reporté puis reprogrammé redevient « programmé ».
  const status = m.match.status === "POSTPONED" && kickoffAt ? "SCHEDULED" : m.match.status;

  try {
    await db.transaction(async (tx) => {
      await tx.update(matches).set({ kickoffAt, venue, stadiumId: stadium?.id ?? null, status, updatedBy: user.id, updatedAt: new Date() }).where(eq(matches.id, matchId));
      if (kickoffAt) await tx.update(matchOfficials).set({ matchDay: matchDay(kickoffAt) }).where(eq(matchOfficials.matchId, matchId));
    });
  } catch (e) {
    if (isUniqueViolation(e, "match_officials_referee_day_uq")) {
      return { error: "Un officiel désigné sur ce match officie déjà un autre match ce jour-là : modifiez d'abord les désignations." };
    }
    throw e;
  }
  await logAudit({
    userId: user.id,
    action: "SCHEDULE",
    entity: "match",
    entityId: matchId,
    details: { before: { kickoffAt: m.match.kickoffAt, venue: m.match.venue, stadiumId: m.match.stadiumId }, after: { kickoffAt, venue, stadiumId: stadium?.id ?? null } },
  });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Programmation enregistrée." };
}

const score = z.preprocess(blankToNull, z.coerce.number().int().min(0, { error: "Score invalide." }).max(99, { error: "Score invalide." }).nullable());

/**
 * Feuille de match : statut, score, affluence, rapport, tirs au but (EF-CMP-04).
 * Organisateur de la compétition ou commissaire désigné (EF-CMP-09).
 * Résultat officiel : un match terminé saisi par l'organisateur est validé d'office ; saisi par le
 * commissaire, il attend la validation de l'organisateur et ne compte pas encore au classement.
 * Un résultat validé ne peut plus être modifié que par l'organisateur (correction tracée au journal).
 */
export async function updateMatchSheet(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return { error: "Vous n'êtes pas autorisé à modifier cette feuille de match." };
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  if (!m.match.homeClubId || !m.match.awayClubId) return { error: "Les deux équipes ne sont pas encore connues." };
  const organiser = await canManageMatch(user, matchId);
  if (m.match.validatedAt && !organiser) return VALIDATED;

  const parsed = z
    .object({
      status: z.enum(MATCH_STATUSES),
      homeScore: score,
      awayScore: score,
      attendance: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(200_000).nullable()),
      report: z.preprocess(blankToNull, z.string().trim().max(5000).nullable()),
      homePenalties: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
      awayPenalties: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
      // Vide : période déduite (coup d'envoi, reprise).
      period: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(4).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { homeScore, awayScore, period: requested, ...d } = parsed.data;
  const clock = nextPeriod(
    { status: m.match.status, period: m.match.period as MatchPeriod | null },
    { status: d.status, period: requested as MatchPeriod | null },
  );
  if ((homeScore === null) !== (awayScore === null)) return { error: "Saisissez le score des deux équipes." };

  // Score saisi directement (buteurs inconnus) : refusé s'il contredit les buts déjà saisis.
  const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, matchId));
  const goals = events.filter((e) => GOAL_EVENTS.includes(e.type));
  if (homeScore !== null && goals.length > 0) {
    const computed = scoreFromEvents(events, m.match.homeClubId, m.match.awayClubId);
    if (computed.home !== homeScore || computed.away !== awayScore) {
      return { error: `Le score est calculé à partir des buts saisis (${computed.home} – ${computed.away}) : corrigez les buts.` };
    }
  }

  const finished = d.status === "FINISHED";
  const validatedAt = finished && organiser ? (m.match.validatedAt ?? new Date()) : null;
  await db
    .update(matches)
    .set({
      ...d,
      ...(homeScore !== null && goals.length === 0 && { homeScore, awayScore }),
      period: clock.period,
      ...(clock.restart && { periodStartedAt: new Date() }),
      validatedAt,
      validatedBy: validatedAt ? (m.match.validatedBy ?? user.id) : null,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));
  await recomputeMatch(matchId);
  const [after] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

  // Coupe terminée sur un nul sans tirs au but : pas de vainqueur, on le signale.
  if (m.competition.type === "CUP" && finished) {
    if (after.homeScore === after.awayScore && (d.homePenalties === null || d.awayPenalties === null || d.homePenalties === d.awayPenalties)) {
      return { error: "Match nul en coupe : saisissez le résultat des tirs au but pour désigner le qualifié." };
    }
  }
  const correction = m.match.validatedAt !== null && (m.match.homeScore !== after.homeScore || m.match.awayScore !== after.awayScore || m.match.status !== after.status);
  await logAudit({
    userId: user.id,
    action: correction ? "RESULT_CORRECTION" : "MATCH_SHEET",
    entity: "match",
    entityId: matchId,
    details: {
      before: { status: m.match.status, score: [m.match.homeScore, m.match.awayScore] },
      after: { status: after.status, score: [after.homeScore, after.awayScore], period: after.period },
      validated: Boolean(after.validatedAt),
    },
  });
  revalidateMatch(matchId, m.match.competitionId);
  if (finished && !organiser) return { success: "Feuille de match enregistrée. Le résultat sera officiel après validation par l'organisateur." };
  return { success: "Feuille de match enregistrée." };
}

/** Validation officielle d'un résultat saisi par le commissaire : il compte alors au classement et s'affiche comme définitif. */
export async function validateResult(matchId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await canManageMatch(user, matchId))) return OUT_OF_SCOPE;
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  if (m.match.status !== "FINISHED" || m.match.homeScore === null || m.match.awayScore === null) return { error: "Seul un match terminé avec son score peut être validé." };
  if (m.match.validatedAt) return { success: "Résultat déjà validé." };
  await db.update(matches).set({ validatedAt: new Date(), validatedBy: user.id }).where(eq(matches.id, matchId));
  await logAudit({ userId: user.id, action: "RESULT_VALIDATED", entity: "match", entityId: matchId, details: { score: [m.match.homeScore, m.match.awayScore] } });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Résultat validé : il compte désormais au classement." };
}

/** Buts, penalties, buts contre son camp, cartons, remplacements, avec minute et joueur (EF-CMP-05). */
export async function addMatchEvent(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return { error: "Vous n'êtes pas autorisé à modifier cette feuille de match." };
  const m = await loadMatch(matchId);
  if (!m?.match.homeClubId || !m.match.awayClubId) return { error: "Les deux équipes ne sont pas encore connues." };
  if (m.match.validatedAt && !(await canManageMatch(user, matchId))) return VALIDATED;

  const parsed = z
    .object({
      type: z.enum(EVENT_TYPES),
      minute: z.coerce.number({ error: "Minute requise." }).int().min(1, { error: "Minute entre 1 et 130." }).max(130, { error: "Minute entre 1 et 130." }),
      playerId: z.coerce.number({ error: "Joueur requis." }).int().positive({ error: "Joueur requis." }),
      playerInId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const e = parsed.data;
  if (e.type === "SUBSTITUTION" && (e.playerInId === null || e.playerInId === e.playerId)) return { error: "Remplacement : choisissez le joueur entrant." };
  const playerInId = e.type === "SUBSTITUTION" ? e.playerInId : null;

  // Le joueur doit appartenir à l'une des deux équipes ; le remplaçant, à la même équipe.
  const ids = [e.playerId, ...(playerInId ? [playerInId] : [])];
  const found = await db.select({ id: players.id, clubId: players.clubId }).from(players).where(inArray(players.id, ids));
  const clubOf = (id: number) => found.find((p) => p.id === id)?.clubId ?? null;
  const clubId = clubOf(e.playerId);
  if (!clubId || ![m.match.homeClubId, m.match.awayClubId].includes(clubId)) {
    return { error: "Ce joueur n'appartient à aucune des deux équipes." };
  }
  if (playerInId && clubOf(playerInId) !== clubId) return { error: "Le joueur entrant doit être de la même équipe." };
  await db.insert(matchEvents).values({ matchId, type: e.type, minute: e.minute, playerId: e.playerId, playerInId, clubId, createdBy: user.id });
  await recomputeMatch(matchId);
  await logAudit({ userId: user.id, action: "MATCH_EVENT", entity: "match", entityId: matchId, details: { ...e, playerInId } });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Événement ajouté." };
}

export async function deleteMatchEvent(matchId: number, eventId: number): Promise<void> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return;
  const m = await loadMatch(matchId);
  if (!m) return;
  if (m.match.validatedAt && !(await canManageMatch(user, matchId))) return;
  await db.delete(matchEvents).where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));
  await recomputeMatch(matchId);
  await logAudit({ userId: user.id, action: "MATCH_EVENT_DELETE", entity: "match", entityId: matchId, details: { eventId } });
  revalidateMatch(matchId, m.match.competitionId);
}

// ─── Compositions d'équipe (EF-CMP-07) ───────────────────────────────────────

export async function saveLineup(matchId: number, clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const own = can(user.role, "lineups.submit") && user.clubId === clubId;
  if (!own && !(await canManageMatch(user, matchId))) return { error: "Seul le club peut déposer sa composition." };
  const m = await loadMatch(matchId);
  if (!m || (m.match.homeClubId !== clubId && m.match.awayClubId !== clubId)) return { error: "Ce club ne joue pas ce match." };

  const entries: LineupEntry[] = formData
    .getAll("playerIds")
    .map(Number)
    .filter(Number.isInteger)
    .map((playerId) => {
      const n = String(formData.get(`shirt_${playerId}`) ?? "").trim();
      return { playerId, starter: formData.get(`starter_${playerId}`) === "on", shirtNumber: n === "" ? null : Number(n) };
    });
  const eligible = new Set((await eligiblePlayers(clubId, m.competition.season)).map((p) => p.id));
  const error = lineupError(entries, { eligible, kickoffAt: m.match.kickoffAt });
  if (error) return { error };
  // Discipline (M18) : un joueur suspendu ne peut pas être aligné.
  const suspended = await suspendedPlayers(clubId, m.competition.id);
  const blocked = entries.filter((e) => suspended.has(e.playerId));
  if (blocked.length > 0) return { error: `${blocked.length} joueur(s) suspendu(s) ne peuvent pas figurer sur la feuille de match.` };
  // Capitaine (facultatif) : un des titulaires de la composition.
  const captainId = Number(formData.get("captainId")) || null;
  if (captainId !== null && !entries.some((e) => e.playerId === captainId && e.starter)) return { error: "Le capitaine doit être l'un des titulaires." };

  await db.transaction(async (tx) => {
    await tx.delete(matchLineups).where(and(eq(matchLineups.matchId, matchId), eq(matchLineups.clubId, clubId)));
    await tx.insert(matchLineups).values(entries.map((e) => ({ ...e, matchId, clubId, captain: e.playerId === captainId })));
  });
  await logAudit({ userId: user.id, action: "LINEUP", entity: "match", entityId: matchId, details: { clubId, players: entries.length, captainId } });
  revalidatePath(matchPath(matchId));
  return { success: "Composition enregistrée." };
}

// ─── Désignations des officiels (EF-ARB-02, EF-ARB-03, RG-08) ────────────────

export async function designateOfficial(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("refereeing.manage");
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  if (!m.match.kickoffAt) return { error: "Programmez d'abord la date du match." };
  const role = z.enum(OFFICIAL_ROLES).safeParse(formData.get("role"));
  const refereeId = Number(formData.get("refereeId"));
  if (!role.success || !Number.isInteger(refereeId) || refereeId <= 0) return { error: "Choisissez une fonction et un officiel." };
  const [ref] = await db.select({ active: referees.active }).from(referees).where(eq(referees.id, refereeId)).limit(1);
  if (!ref?.active) return { error: "Officiel introuvable ou inactif." };

  const day = matchDay(m.match.kickoffAt);
  const existing = await db
    .select({ matchId: matchOfficials.matchId, refereeId: matchOfficials.refereeId, role: matchOfficials.role, day: matchOfficials.matchDay })
    .from(matchOfficials)
    .where(inArray(matchOfficials.refereeId, [refereeId]));
  const onMatch = await db
    .select({ matchId: matchOfficials.matchId, refereeId: matchOfficials.refereeId, role: matchOfficials.role, day: matchOfficials.matchDay })
    .from(matchOfficials)
    .where(eq(matchOfficials.matchId, matchId));
  const error = designationError({ matchId, refereeId, role: role.data, day }, [...existing, ...onMatch]);
  if (error) return { error };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(matchOfficials).where(and(eq(matchOfficials.matchId, matchId), eq(matchOfficials.role, role.data)));
      await tx.insert(matchOfficials).values({ matchId, refereeId, role: role.data, matchDay: day });
    });
  } catch (e) {
    // Garde-fou en base si deux désignations concurrentes passent le contrôle en même temps.
    if (isUniqueViolation(e)) return { error: "Conflit de désignation (même jour ou même match) : rechargez la page." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "DESIGNATE", entity: "match", entityId: matchId, details: { refereeId, role: role.data } });
  revalidatePath(matchPath(matchId));
  return { success: "Désignation enregistrée." };
}

export async function removeOfficial(matchId: number, officialId: number): Promise<void> {
  const user = await requirePermission("refereeing.manage");
  await db.delete(matchOfficials).where(and(eq(matchOfficials.id, officialId), eq(matchOfficials.matchId, matchId)));
  await logAudit({ userId: user.id, action: "UNDESIGNATE", entity: "match", entityId: matchId, details: { officialId } });
  revalidatePath(matchPath(matchId));
}

/** Rapport en ligne de l'officiel sur sa désignation (EF-ARB-04). */
export async function submitOfficialReport(officialId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("referee.self");
  const ref = await refereeOf(user);
  const report = String(formData.get("report") ?? "").trim();
  if (report.length < 10) return { error: "Le rapport doit faire au moins 10 caractères." };
  const updated = await db
    .update(matchOfficials)
    .set({ report, reportAt: new Date() })
    .where(and(eq(matchOfficials.id, officialId), eq(matchOfficials.refereeId, ref?.id ?? -1)))
    .returning({ matchId: matchOfficials.matchId });
  if (updated.length === 0) return { error: "Désignation introuvable." };
  await logAudit({ userId: user.id, action: "OFFICIAL_REPORT", entity: "match", entityId: updated[0].matchId });
  revalidatePath("/admin/espace-arbitre");
  return { success: "Rapport transmis." };
}

/** Mise en avant d'un match sur la page d'accueil (« À la une ») : décision de l'organisateur, tracée au journal. */
export async function setMatchFeatured(matchId: number, featured: boolean): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await canManageMatch(user, matchId))) return OUT_OF_SCOPE;
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  await db.update(matches).set({ featured, updatedBy: user.id, updatedAt: new Date() }).where(eq(matches.id, matchId));
  await logAudit({ userId: user.id, action: featured ? "FEATURE" : "UNFEATURE", entity: "match", entityId: matchId });
  revalidateMatch(matchId, m.match.competitionId);
  revalidatePath("/");
  return { success: featured ? "Match mis à la une de la page d'accueil." : "Match retiré de la une." };
}
