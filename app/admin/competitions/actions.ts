"use server";

import { randomInt } from "node:crypto";
import { and, count, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { buildBracket, COMPETITION_STATUSES, COMPETITION_TYPES, GENDERS, roundRobin, shuffle } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitions, competitionTeams, matches } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { CATEGORIES, seasonLabel } from "@/lib/licenses";
import { advanceWinner } from "@/lib/queries/competitions";

const path = (id: number) => `/admin/competitions/${id}`;

const CompetitionSchema = z.object({
  name: z.string().trim().min(3, { error: "Nom requis." }).max(160),
  season: z.coerce.number().int().min(2000).max(2100),
  category: z.enum(CATEGORIES),
  gender: z.enum(GENDERS),
  type: z.enum(COMPETITION_TYPES),
  doubleRound: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  pointsWin: z.coerce.number().int().min(0).max(10),
  pointsDraw: z.coerce.number().int().min(0).max(10),
  pointsLoss: z.coerce.number().int().min(-5).max(10),
});

/** Création d'un championnat, d'une coupe ou d'un tournoi (EF-CMP-01). */
export async function createCompetition(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const parsed = CompetitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const c = parsed.data;

  const base = slugify(`${c.name} ${seasonLabel(c.season)}`);
  const taken = new Set((await db.select({ slug: competitions.slug }).from(competitions).where(like(competitions.slug, `${base}%`))).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const [created] = await db.insert(competitions).values({ ...c, slug }).returning({ id: competitions.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "competition", entityId: created.id, details: { name: c.name, season: c.season } });
  revalidatePath("/admin/competitions");
  redirect(path(created.id));
}

export async function setCompetitionStatus(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const status = z.enum(COMPETITION_STATUSES).safeParse(formData.get("status"));
  if (!status.success) return { error: "Statut invalide." };
  await db.update(competitions).set({ status: status.data }).where(eq(competitions.id, competitionId));
  await logAudit({ userId: user.id, action: "STATUS_CHANGE", entity: "competition", entityId: competitionId, details: { to: status.data } });
  revalidatePath(path(competitionId));
  return { success: "Statut mis à jour." };
}

async function hasMatches(competitionId: number) {
  const [{ n }] = await db.select({ n: count() }).from(matches).where(eq(matches.competitionId, competitionId));
  return n > 0;
}

/** Engagement d'un club (EF-CMP-02) : club affilié, avant la génération du calendrier. */
export async function engageClub(competitionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const clubId = Number(formData.get("clubId"));
  const pool = z.preprocess(blankToNull, z.string().trim().toUpperCase().max(8).nullable()).parse(formData.get("pool"));
  if (!Number.isInteger(clubId) || clubId <= 0) return { error: "Choisissez un club." };
  if (await hasMatches(competitionId)) return { error: "Le calendrier est déjà généré : les engagements sont clos." };
  const [club] = await db.select({ status: clubs.status }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (club?.status !== "AFFILIATED") return { error: "Seul un club affilié peut être engagé." };

  const inserted = await db.insert(competitionTeams).values({ competitionId, clubId, pool }).onConflictDoNothing().returning({ id: competitionTeams.id });
  if (inserted.length === 0) return { error: "Ce club est déjà engagé." };
  await logAudit({ userId: user.id, action: "ENGAGE", entity: "competition", entityId: competitionId, details: { clubId, pool } });
  revalidatePath(path(competitionId));
  return { success: "Club engagé." };
}

export async function withdrawClub(competitionId: number, clubId: number): Promise<void> {
  const user = await requirePermission("competitions.manage");
  if (await hasMatches(competitionId)) return;
  await db.delete(competitionTeams).where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.clubId, clubId)));
  await logAudit({ userId: user.id, action: "WITHDRAW", entity: "competition", entityId: competitionId, details: { clubId } });
  revalidatePath(path(competitionId));
}

/** Pénalité de points (EF-CMP-02), motivée. */
export async function setPenalty(competitionId: number, clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
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
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!competition || competition.type !== "LEAGUE") return { error: "Réservé aux championnats et tournois." };
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

/** Tirage au sort et tableau d'une coupe à élimination directe (EF-CMP-08). */
export async function drawCup(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!competition || competition.type !== "CUP") return { error: "Réservé aux coupes." };
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

