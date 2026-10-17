"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { blankToNull, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { EVENT_TYPES, lineupError, MATCH_STATUSES, type LineupEntry } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, matchEvents, matches, matchLineups, matchOfficials, players, referees } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/queries/players";
import { canEditMatchSheet, eligiblePlayers, recomputeMatch, refereeOf } from "@/lib/queries/competitions";
import { suspendedPlayers } from "@/lib/queries/discipline";
import { designationError, matchDay, OFFICIAL_ROLES } from "@/lib/referees";

const matchPath = (id: number) => `/admin/matchs/${id}`;

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
}

/** Programmation : date, heure, stade (fédération). Les désignations suivent la nouvelle date (RG-08). */
export async function scheduleMatch(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  const raw = String(formData.get("kickoffAt") ?? "");
  // Saisie « AAAA-MM-JJTHH:MM » en heure de Brazzaville (UTC+1).
  const kickoffAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(`${raw}:00+01:00`) : null;
  const venue = z.preprocess(blankToNull, z.string().trim().max(160).nullable()).parse(formData.get("venue"));

  try {
    await db.transaction(async (tx) => {
      await tx.update(matches).set({ kickoffAt, venue, updatedBy: user.id, updatedAt: new Date() }).where(eq(matches.id, matchId));
      if (kickoffAt) await tx.update(matchOfficials).set({ matchDay: matchDay(kickoffAt) }).where(eq(matchOfficials.matchId, matchId));
    });
  } catch (e) {
    if (isUniqueViolation(e, "match_officials_referee_day_uq")) {
      return { error: "Un officiel désigné sur ce match officie déjà un autre match ce jour-là : modifiez d'abord les désignations." };
    }
    throw e;
  }
  await logAudit({ userId: user.id, action: "SCHEDULE", entity: "match", entityId: matchId, details: { kickoffAt, venue } });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Programmation enregistrée." };
}

/** Feuille de match : statut, affluence, rapport, tirs au but (EF-CMP-04). Fédération ou commissaire désigné (EF-CMP-09). */
export async function updateMatchSheet(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return { error: "Vous n'êtes pas autorisé à modifier cette feuille de match." };
  const m = await loadMatch(matchId);
  if (!m) return { error: "Match introuvable." };
  if (!m.match.homeClubId || !m.match.awayClubId) return { error: "Les deux équipes ne sont pas encore connues." };

  const parsed = z
    .object({
      status: z.enum(MATCH_STATUSES),
      attendance: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(200_000).nullable()),
      report: z.preprocess(blankToNull, z.string().trim().max(5000).nullable()),
      homePenalties: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
      awayPenalties: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const d = parsed.data;

  await db
    .update(matches)
    .set({ ...d, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(matches.id, matchId));
  await recomputeMatch(matchId);

  // Coupe terminée sur un nul sans tirs au but : pas de vainqueur, on le signale.
  if (m.competition.type === "CUP" && d.status === "FINISHED") {
    const [after] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (after.homeScore === after.awayScore && (d.homePenalties === null || d.awayPenalties === null || d.homePenalties === d.awayPenalties)) {
      return { error: "Match nul en coupe : saisissez le résultat des tirs au but pour désigner le qualifié." };
    }
  }
  await logAudit({ userId: user.id, action: "MATCH_SHEET", entity: "match", entityId: matchId, details: { status: d.status } });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Feuille de match enregistrée." };
}

/** Buts, penalties, buts contre son camp, cartons, avec minute et joueur (EF-CMP-05). */
export async function addMatchEvent(matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return { error: "Vous n'êtes pas autorisé à modifier cette feuille de match." };
  const m = await loadMatch(matchId);
  if (!m?.match.homeClubId || !m.match.awayClubId) return { error: "Les deux équipes ne sont pas encore connues." };

  const parsed = z
    .object({
      type: z.enum(EVENT_TYPES),
      minute: z.coerce.number({ error: "Minute requise." }).int().min(1, { error: "Minute entre 1 et 130." }).max(130, { error: "Minute entre 1 et 130." }),
      playerId: z.coerce.number({ error: "Joueur requis." }).int().positive({ error: "Joueur requis." }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  // Le joueur doit appartenir à l'une des deux équipes.
  const [player] = await db.select({ clubId: players.clubId }).from(players).where(eq(players.id, parsed.data.playerId)).limit(1);
  if (!player?.clubId || ![m.match.homeClubId, m.match.awayClubId].includes(player.clubId)) {
    return { error: "Ce joueur n'appartient à aucune des deux équipes." };
  }
  await db.insert(matchEvents).values({ matchId, ...parsed.data, clubId: player.clubId, createdBy: user.id });
  await recomputeMatch(matchId);
  await logAudit({ userId: user.id, action: "MATCH_EVENT", entity: "match", entityId: matchId, details: parsed.data });
  revalidateMatch(matchId, m.match.competitionId);
  return { success: "Événement ajouté." };
}

export async function deleteMatchEvent(matchId: number, eventId: number): Promise<void> {
  const user = await requireUser();
  if (!(await canEditMatchSheet(user, matchId))) return;
  const m = await loadMatch(matchId);
  if (!m) return;
  await db.delete(matchEvents).where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));
  await recomputeMatch(matchId);
  await logAudit({ userId: user.id, action: "MATCH_EVENT_DELETE", entity: "match", entityId: matchId, details: { eventId } });
  revalidateMatch(matchId, m.match.competitionId);
}

// ─── Compositions d'équipe (EF-CMP-07) ───────────────────────────────────────

export async function saveLineup(matchId: number, clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const own = can(user.role, "lineups.submit") && user.clubId === clubId;
  if (!own && !can(user.role, "competitions.manage")) return { error: "Seul le club peut déposer sa composition." };
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

  await db.transaction(async (tx) => {
    await tx.delete(matchLineups).where(and(eq(matchLineups.matchId, matchId), eq(matchLineups.clubId, clubId)));
    await tx.insert(matchLineups).values(entries.map((e) => ({ ...e, matchId, clubId })));
  });
  await logAudit({ userId: user.id, action: "LINEUP", entity: "match", entityId: matchId, details: { clubId, players: entries.length } });
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
