"use server";

import { randomInt } from "node:crypto";
import { and, count, desc, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, type CurrentUser } from "@/lib/auth/guard";
import {
  buildBracket,
  COMPETITION_CATEGORIES,
  COMPETITION_STATUSES,
  COMPETITION_TYPES,
  GENDERS,
  parseTiebreakers,
  roundRobin,
  TEAM_OUTCOMES,
  shuffle,
} from "@/lib/competitions";
import { db } from "@/lib/db";
import { blockedMessage, competitionBlockers, deleteCompetitionRecord } from "@/lib/deletion";
import { championships, clubs, competitions, competitionTeams, leagues, matches } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { advanceWinner, competitionFor } from "@/lib/queries/competitions";

const path = (id: number) => `/admin/competitions/${id}`;
const OUT_OF_SCOPE: ActionState = { error: "Cette compétition n'est pas dans votre périmètre." };

const CompetitionSchema = z.object({
  name: z.string().trim().min(3, { error: "Nom requis." }).max(160),
  season: z.coerce.number().int().min(2000).max(2100),
  category: z.enum(COMPETITION_CATEGORIES),
  gender: z.enum(GENDERS),
  type: z.enum(COMPETITION_TYPES),
  // Vide : compétition nationale ; sinon la ligue organisatrice (championnat départemental).
  leagueId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  doubleRound: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  pointsWin: z.coerce.number().int().min(0).max(10),
  pointsDraw: z.coerce.number().int().min(0).max(10),
  pointsLoss: z.coerce.number().int().min(-5).max(10),
  // Montées et descentes de la saison, par poule (règlement de la saison) ; absent : aucune.
  promotionSpots: z.preprocess((v) => (v === undefined || v === "" ? 0 : v), z.coerce.number().int().min(0).max(20)),
  relegationSpots: z.preprocess((v) => (v === undefined || v === "" ? 0 : v), z.coerce.number().int().min(0).max(20)),
});

/** Champ multiple « tiebreakers » (cases à cocher, ordre du formulaire = ordre d'application). */
const tiebreakersOf = (formData: FormData) => parseTiebreakers(formData.getAll("tiebreakers"));

/**
 * Ligue organisatrice retenue : un responsable départemental ne crée que des compétitions de sa ligue ;
 * la ligue choisie doit exister et être active.
 */
async function organiserError(user: CurrentUser, leagueId: number | null): Promise<string | null> {
  if (user.role === "LEAGUE" && leagueId !== user.leagueId) return "Une ligue ne gère que les compétitions de son département.";
  if (leagueId === null) return null;
  const [l] = await db.select({ active: leagues.active }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!l) return "Ligue introuvable.";
  if (!l.active) return "Cette ligue est désactivée.";
  return null;
}

/** Création d'un championnat, d'une coupe ou d'un tournoi (EF-CMP-01), national ou départemental. */
export async function createCompetition(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const raw = Object.fromEntries(formData);
  // Un compte de ligue n'a pas le choix de l'organisateur : sa propre ligue.
  if (user.role === "LEAGUE") raw.leagueId = String(user.leagueId ?? "");
  const parsed = CompetitionSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const c = parsed.data;
  const scopeError = await organiserError(user, c.leagueId);
  if (scopeError) return { error: scopeError, fieldErrors: { leagueId: [scopeError] } };

  const base = slugify(`${c.name} ${seasonLabel(c.season)}`);
  const taken = new Set((await db.select({ slug: competitions.slug }).from(competitions).where(like(competitions.slug, `${base}%`))).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const [created] = await db
    .insert(competitions)
    .values({ ...c, slug, tiebreakers: tiebreakersOf(formData) })
    .returning({ id: competitions.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "competition", entityId: created.id, details: { name: c.name, season: c.season, leagueId: c.leagueId } });
  revalidatePath("/admin/competitions");
  redirect(path(created.id));
}

/**
 * Modification d'une compétition. L'adresse publique (slug) ne change pas.
 * Le format (type, aller-retour) est figé dès que le calendrier existe ; le barème et le départage
 * restent modifiables (décision réglementaire) et le classement est recalculé à l'affichage.
 */
export async function updateCompetition(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const current = await competitionFor(user, competitionId);
  if (!current) return OUT_OF_SCOPE;
  const raw = Object.fromEntries(formData);
  if (user.role === "LEAGUE") raw.leagueId = String(user.leagueId ?? "");
  const parsed = CompetitionSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  const c = parsed.data;
  if (current.championshipId !== null && c.leagueId !== null) return { error: "Une saison de championnat national reste organisée par la fédération." };
  if (c.leagueId !== current.leagueId) {
    const scopeError = await organiserError(user, c.leagueId);
    if (scopeError) return { error: scopeError, fieldErrors: { leagueId: [scopeError] } };
  }
  const started = await hasMatches(competitionId);
  if (started && (c.type !== current.type || c.doubleRound !== current.doubleRound)) {
    return { error: "Le calendrier est généré : le type et le format aller-retour ne peuvent plus changer." };
  }
  if (started && c.season !== current.season) return { error: "Le calendrier est généré : la saison ne peut plus changer." };
  const tiebreakers = tiebreakersOf(formData);
  // Saison en cours d'une division nationale renommée : la division prend le même nom (menu, onglets, page du
  // championnat). Une saison passée renommée ne change pas la division.
  const latest =
    current.championshipId !== null && c.name !== current.name && current.status !== "FINISHED"
      ? (await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.championshipId, current.championshipId)).orderBy(desc(competitions.season)).limit(1))[0]?.id === competitionId
      : false;
  await db.transaction(async (tx) => {
    await tx
      .update(competitions)
      .set({ ...c, tiebreakers })
      .where(eq(competitions.id, competitionId));
    if (latest) await tx.update(championships).set({ name: c.name, updatedAt: new Date() }).where(eq(championships.id, current.championshipId!));
  });
  await logAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "competition",
    entityId: competitionId,
    details: {
      before: {
        name: current.name,
        leagueId: current.leagueId,
        points: [current.pointsWin, current.pointsDraw, current.pointsLoss],
        tiebreakers: current.tiebreakers,
        spots: [current.promotionSpots, current.relegationSpots],
      },
      after: { name: c.name, leagueId: c.leagueId, points: [c.pointsWin, c.pointsDraw, c.pointsLoss], tiebreakers, spots: [c.promotionSpots, c.relegationSpots] },
      ...(latest && { championshipRenamed: current.championshipId }),
    },
  });
  revalidatePath(path(competitionId));
  revalidatePath("/competitions", "layout");
  if (latest) revalidatePath("/", "layout");
  return { success: latest ? "Compétition mise à jour ; la division porte désormais le même nom." : "Compétition mise à jour." };
}

export async function setCompetitionStatus(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await competitionFor(user, competitionId))) return OUT_OF_SCOPE;
  const status = z.enum(COMPETITION_STATUSES).safeParse(formData.get("status"));
  if (!status.success) return { error: "Statut invalide." };
  await db.update(competitions).set({ status: status.data }).where(eq(competitions.id, competitionId));
  await logAudit({ userId: user.id, action: "STATUS_CHANGE", entity: "competition", entityId: competitionId, details: { to: status.data } });
  revalidatePath(path(competitionId));
  revalidatePath("/competitions", "layout");
  return { success: "Statut mis à jour." };
}

async function hasMatches(competitionId: number) {
  const [{ n }] = await db.select({ n: count() }).from(matches).where(eq(matches.competitionId, competitionId));
  return n > 0;
}

/**
 * Engagement d'un club (EF-CMP-02) : club affilié, avant la génération du calendrier, une seule fois
 * par compétition. Un championnat départemental n'accueille que les clubs de sa ligue.
 */
export async function engageClub(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const competition = await competitionFor(user, competitionId);
  if (!competition) return OUT_OF_SCOPE;
  const clubId = Number(formData.get("clubId"));
  const pool = z.preprocess(blankToNull, z.string().trim().toUpperCase().max(8).nullable()).parse(formData.get("pool"));
  if (!Number.isInteger(clubId) || clubId <= 0) return { error: "Choisissez un club." };
  if (await hasMatches(competitionId)) return { error: "Le calendrier est déjà généré : les engagements sont clos." };
  const [club] = await db.select({ status: clubs.status, leagueId: clubs.leagueId }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (club?.status !== "AFFILIATED") return { error: "Seul un club affilié peut être engagé." };
  if (competition.leagueId !== null && club.leagueId !== competition.leagueId) return { error: "Ce club ne relève pas de la ligue organisatrice." };

  const inserted = await db.insert(competitionTeams).values({ competitionId, clubId, pool }).onConflictDoNothing().returning({ id: competitionTeams.id });
  if (inserted.length === 0) return { error: "Ce club est déjà engagé." };
  await logAudit({ userId: user.id, action: "ENGAGE", entity: "competition", entityId: competitionId, details: { clubId, pool } });
  revalidatePath(path(competitionId));
  return { success: "Club engagé." };
}

export async function withdrawClub(competitionId: number, clubId: number): Promise<void> {
  const user = await requirePermission("competitions.manage");
  if (!(await competitionFor(user, competitionId))) return;
  if (await hasMatches(competitionId)) return;
  await db.delete(competitionTeams).where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.clubId, clubId)));
  await logAudit({ userId: user.id, action: "WITHDRAW", entity: "competition", entityId: competitionId, details: { clubId } });
  revalidatePath(path(competitionId));
}

/** Statut sportif d'un club dans la saison (champion, promu, maintenu, relégué…), selon le règlement. */
export async function setTeamOutcome(competitionId: number, clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await competitionFor(user, competitionId))) return OUT_OF_SCOPE;
  const outcome = z.preprocess(blankToNull, z.enum(TEAM_OUTCOMES).nullable()).safeParse(formData.get("outcome"));
  if (!outcome.success) return { error: "Statut invalide." };
  const updated = await db
    .update(competitionTeams)
    .set({ outcome: outcome.data })
    .where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.clubId, clubId)))
    .returning({ id: competitionTeams.id });
  if (updated.length === 0) return { error: "Ce club n'est pas engagé." };
  await logAudit({ userId: user.id, action: "TEAM_OUTCOME", entity: "competition", entityId: competitionId, details: { clubId, outcome: outcome.data } });
  revalidatePath(path(competitionId));
  revalidatePath("/championnats", "layout");
  return { success: "Statut enregistré." };
}

/** Pénalité de points (EF-CMP-02), motivée. */
export async function setPenalty(competitionId: number, clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await competitionFor(user, competitionId))) return OUT_OF_SCOPE;
  const points = z.coerce.number().int().min(0).max(100).safeParse(formData.get("points"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!points.success) return { error: "Nombre de points invalide." };
  if (points.data > 0 && reason.length < 3) return { error: "Indiquez le motif de la pénalité." };
  await db
    .update(competitionTeams)
    .set({ pointsPenalty: points.data, penaltyReason: points.data > 0 ? reason : null })
    .where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.clubId, clubId)));
  await logAudit({ userId: user.id, action: "POINTS_PENALTY", entity: "competition", entityId: competitionId, details: { clubId, points: points.data, reason } });
  revalidatePath(path(competitionId));
  return { success: "Pénalité enregistrée." };
}

/**
 * Génération automatique du calendrier (EF-CMP-03) : toutes rondes, aller-retour ou aller simple,
 * par poule ; journées sans date, à programmer ensuite.
 */
export async function generateFixtures(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const competition = await competitionFor(user, competitionId);
  if (!competition) return OUT_OF_SCOPE;
  if (competition.type !== "LEAGUE") return { error: "Réservé aux championnats et tournois." };
  if (await hasMatches(competitionId)) return { error: "Le calendrier est déjà généré." };

  const teams = await db.select().from(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));
  const pools = [...new Set(teams.map((t) => t.pool))];
  const rows = pools.flatMap((pool) => {
    const ids = teams.filter((t) => t.pool === pool).map((t) => t.clubId);
    return roundRobin(ids, { doubleRound: competition.doubleRound }).map((p) => ({
      competitionId,
      round: p.round,
      pool,
      homeClubId: p.home,
      awayClubId: p.away,
    }));
  });
  if (rows.length === 0) return { error: "Engagez au moins deux clubs par poule." };

  await db.insert(matches).values(rows);
  await db.update(competitions).set({ status: "ONGOING" }).where(eq(competitions.id, competitionId));
  await logAudit({ userId: user.id, action: "GENERATE_FIXTURES", entity: "competition", entityId: competitionId, details: { matches: rows.length } });
  revalidatePath(path(competitionId));
  return { success: `${rows.length} matchs générés.` };
}

/**
 * Ajout manuel d'une rencontre (match en retard, barrage, format irrégulier) entre deux clubs engagés.
 * Les coupes passent par le tirage au sort, qui construit tout le tableau.
 */
export async function addFixture(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const competition = await competitionFor(user, competitionId);
  if (!competition) return OUT_OF_SCOPE;
  if (competition.type !== "LEAGUE") return { error: "Coupe : les rencontres viennent du tirage au sort." };
  const parsed = z
    .object({
      round: z.coerce.number({ error: "Journée requise." }).int().min(1, { error: "Journée invalide." }).max(200, { error: "Journée invalide." }),
      homeClubId: z.coerce.number({ error: "Choisissez l'équipe qui reçoit." }).int().positive({ error: "Choisissez l'équipe qui reçoit." }),
      awayClubId: z.coerce.number({ error: "Choisissez l'équipe visiteuse." }).int().positive({ error: "Choisissez l'équipe visiteuse." }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const f = parsed.data;
  if (f.homeClubId === f.awayClubId) return { error: "Un club ne peut pas se rencontrer lui-même." };
  const teams = await db.select().from(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));
  const home = teams.find((t) => t.clubId === f.homeClubId);
  const away = teams.find((t) => t.clubId === f.awayClubId);
  if (!home || !away) return { error: "Les deux clubs doivent être engagés dans la compétition." };
  if (home.pool !== away.pool) return { error: "Les deux clubs ne sont pas dans la même poule." };
  const [created] = await db.insert(matches).values({ competitionId, round: f.round, pool: home.pool, homeClubId: f.homeClubId, awayClubId: f.awayClubId }).returning({ id: matches.id });
  await logAudit({ userId: user.id, action: "ADD_FIXTURE", entity: "competition", entityId: competitionId, details: { matchId: created.id, ...f } });
  revalidatePath(path(competitionId));
  redirect(`/admin/matchs/${created.id}`);
}

/** Tirage au sort et tableau d'une coupe à élimination directe (EF-CMP-08). */
export async function drawCup(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const competition = await competitionFor(user, competitionId);
  if (!competition) return OUT_OF_SCOPE;
  if (competition.type !== "CUP") return { error: "Réservé aux coupes." };
  if (await hasMatches(competitionId)) return { error: "Le tirage a déjà eu lieu." };

  const teams = await db.select().from(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));
  if (teams.length < 2) return { error: "Engagez au moins deux clubs." };
  // Aléa cryptographique : tirage non prévisible.
  const order = shuffle(
    teams.map((t) => t.clubId),
    () => randomInt(0, 2 ** 32) / 2 ** 32,
  );
  const bracket = buildBracket(order);

  await db.transaction(async (tx) => {
    for (const [i, clubId] of order.entries()) {
      await tx.update(competitionTeams).set({ drawOrder: i + 1 }).where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.clubId, clubId)));
    }
    await tx.insert(matches).values(
      bracket.map((b) => ({ competitionId, round: b.round, bracketSlot: b.slot, homeClubId: b.home, awayClubId: b.away })),
    );
  });
  // Les exemptés passent directement au tour suivant.
  const byes = await db.select({ id: matches.id }).from(matches).where(and(eq(matches.competitionId, competitionId), eq(matches.round, 1)));
  for (const b of byes) await advanceWinner(b.id);

  await db.update(competitions).set({ status: "ONGOING" }).where(eq(competitions.id, competitionId));
  await logAudit({ userId: user.id, action: "CUP_DRAW", entity: "competition", entityId: competitionId, details: { order } });
  revalidatePath(path(competitionId));
  return { success: "Tirage effectué." };
}

/** Suppression d'une compétition encore en préparation (aucun match généré). */
export async function deleteCompetition(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!(await competitionFor(user, competitionId))) return OUT_OF_SCOPE;
  const reasons = await competitionBlockers(competitionId);
  if (reasons.length) return { error: blockedMessage("La compétition", reasons) };
  await deleteCompetitionRecord(competitionId);
  await logAudit({ userId: user.id, action: "DELETE", entity: "competition", entityId: competitionId });
  revalidatePath("/admin/competitions");
  return { success: "Compétition supprimée." };
}
