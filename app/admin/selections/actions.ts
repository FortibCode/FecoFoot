"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalFixtures, nationalStaff, nationalTeams, players, selectionPlayers, selections } from "@/lib/db/schema";
import { POSITIONS } from "@/lib/licenses";
import { calledPlayerError, FIXTURE_STATUSES, shirtNumberError } from "@/lib/national-teams";
import { isUniqueViolation } from "@/lib/queries/players";

async function team(code: string) {
  const [t] = await db.select().from(nationalTeams).where(eq(nationalTeams.code, code as (typeof nationalTeams.$inferSelect)["code"])).limit(1);
  return t ?? null;
}
const revalidateTeam = (code: string, slug?: string) => {
  revalidatePath(`/admin/selections/${code}`);
  if (slug) revalidatePath(`/equipes-nationales/${slug}`);
};

/** Sélectionneur et staff (EF-SEL-01). */
export async function addStaff(code: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection inconnue." };
  const parsed = z
    .object({ fullName: z.string().trim().min(3, { error: "Nom requis." }).max(160), role: z.string().trim().min(2, { error: "Fonction requise." }).max(80) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const order = parsed.data.role.toLowerCase().includes("sélectionneur") && !parsed.data.role.toLowerCase().includes("adjoint") ? 0 : 10;
  await db.insert(nationalStaff).values({ teamId: t.id, ...parsed.data, sortOrder: order });
  await logAudit({ userId: user.id, action: "CREATE", entity: "national_staff", entityId: t.code, details: parsed.data });
  revalidateTeam(code, t.slug);
  return { success: "Membre du staff ajouté." };
}

export async function removeStaff(code: string, staffId: number): Promise<void> {
  const user = await requirePermission("national_teams.manage");
  await db.delete(nationalStaff).where(eq(nationalStaff.id, staffId));
  await logAudit({ userId: user.id, action: "DELETE", entity: "national_staff", entityId: staffId });
  revalidateTeam(code);
}

/** Calendrier et résultats des sélections (EF-SEL-04). */
export async function addFixture(code: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection inconnue." };
  const parsed = z
    .object({
      opponent: z.string().trim().min(2, { error: "Adversaire requis." }).max(120),
      kickoffAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Date et heure requises." }),
      venue: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
      competition: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
      isHome: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await db.insert(nationalFixtures).values({ ...parsed.data, teamId: t.id, kickoffAt: new Date(`${parsed.data.kickoffAt}:00+01:00`) });
  await logAudit({ userId: user.id, action: "CREATE", entity: "national_fixture", entityId: t.code, details: { opponent: parsed.data.opponent } });
  revalidateTeam(code, t.slug);
  return { success: "Match ajouté au calendrier." };
}

export async function setFixtureResult(code: string, fixtureId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const parsed = z
    .object({
      status: z.enum(FIXTURE_STATUSES),
      goalsFor: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
      goalsAgainst: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Résultat invalide." };
  if (parsed.data.status === "PLAYED" && (parsed.data.goalsFor === null || parsed.data.goalsAgainst === null)) return { error: "Saisissez le score." };
  await db.update(nationalFixtures).set(parsed.data).where(eq(nationalFixtures.id, fixtureId));
  await logAudit({ userId: user.id, action: "RESULT", entity: "national_fixture", entityId: fixtureId, details: parsed.data });
  const t = await team(code);
  revalidateTeam(code, t?.slug);
  return { success: "Résultat enregistré." };
}

/** Mise en avant d'un match des sélections sur la page d'accueil (« À la une »), tracée au journal. */
export async function setFixtureFeatured(code: string, fixtureId: number, featured: boolean): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  await db.update(nationalFixtures).set({ featured }).where(and(eq(nationalFixtures.id, fixtureId), eq(nationalFixtures.teamId, t.id)));
  await logAudit({ userId: user.id, action: featured ? "FEATURE" : "UNFEATURE", entity: "national_fixture", entityId: fixtureId });
  revalidateTeam(code, t.slug);
  revalidatePath("/");
  return { success: featured ? "Match mis à la une de la page d'accueil." : "Match retiré de la une." };
}

/** Nouvelle liste de convoqués (EF-SEL-02). */
export async function createSelection(code: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection inconnue." };
  const parsed = z
    .object({
      title: z.string().trim().min(3, { error: "Intitulé requis." }).max(160),
      purpose: z.preprocess(blankToNull, z.string().trim().max(2000).nullable()),
      gatheringDate: z.preprocess(blankToNull, z.iso.date().nullable()),
      location: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [created] = await db
    .insert(selections)
    .values({
      ...parsed.data,
      teamId: t.id,
      gatheringDate: parsed.data.gatheringDate ? new Date(`${parsed.data.gatheringDate}T00:00:00Z`) : null,
      createdBy: user.id,
    })
    .returning({ id: selections.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "selection", entityId: created.id, details: { title: parsed.data.title } });
  redirect(`/admin/selections/convocation/${created.id}`);
}

/** Ajout d'un convoqué : joueur du registre (identifiant fédéral) ou joueur de l'étranger (EF-SEL-02). */
export async function addCalledPlayer(selectionId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const [sel] = await db.select().from(selections).where(eq(selections.id, selectionId)).limit(1);
  if (!sel) return { error: "Liste introuvable." };

  const federalId = String(formData.get("federalId") ?? "").trim().toUpperCase();
  let playerId: number | null = null;
  let position = z.enum(POSITIONS).safeParse(formData.get("position")).data ?? null;
  if (federalId) {
    const [p] = await db.select({ id: players.id, position: players.position }).from(players).where(eq(players.federalId, federalId)).limit(1);
    if (!p) return { error: `Aucun joueur du registre avec l'identifiant ${federalId}.` };
    playerId = p.id;
    position ??= p.position;
  }
  const external = {
    externalName: playerId ? null : String(formData.get("externalName") ?? "").trim() || null,
    externalClub: playerId ? null : String(formData.get("externalClub") ?? "").trim() || null,
    externalCountry: playerId ? null : String(formData.get("externalCountry") ?? "").trim() || null,
  };
  const who = calledPlayerError({ playerId, ...external });
  if (who) return { error: who };

  const raw = String(formData.get("shirtNumber") ?? "").trim();
  const shirtNumber = raw === "" ? null : Number(raw);
  const taken = (await db.select({ n: selectionPlayers.shirtNumber }).from(selectionPlayers).where(eq(selectionPlayers.selectionId, selectionId)))
    .map((r) => r.n)
    .filter((n): n is number => n !== null);
  const numberError = shirtNumberError(shirtNumber, taken);
  if (numberError) return { error: numberError };

  try {
    await db.insert(selectionPlayers).values({ selectionId, playerId, ...external, position, shirtNumber });
  } catch (e) {
    if (isUniqueViolation(e, "selection_players_player_uq")) return { error: "Ce joueur est déjà convoqué." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "CALL_UP", entity: "selection", entityId: selectionId, details: { playerId, ...external } });
  revalidatePath(`/admin/selections/convocation/${selectionId}`);
  return { success: "Joueur ajouté à la liste." };
}

export async function removeCalledPlayer(selectionId: number, entryId: number): Promise<void> {
  const user = await requirePermission("national_teams.manage");
  await db.delete(selectionPlayers).where(and(eq(selectionPlayers.id, entryId), eq(selectionPlayers.selectionId, selectionId)));
  await logAudit({ userId: user.id, action: "CALL_UP_REMOVE", entity: "selection", entityId: selectionId, details: { entryId } });
  revalidatePath(`/admin/selections/convocation/${selectionId}`);
}

/** Publication sur le portail (EF-SEL-03). */
export async function setSelectionPublished(selectionId: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const [sel] = await db
    .update(selections)
    .set({ status: published ? "PUBLISHED" : "DRAFT", publishedAt: published ? new Date() : null })
    .where(eq(selections.id, selectionId))
    .returning({ teamId: selections.teamId });
  if (!sel) return { error: "Liste introuvable." };
  const [t] = await db.select().from(nationalTeams).where(eq(nationalTeams.id, sel.teamId)).limit(1);
  await logAudit({ userId: user.id, action: published ? "PUBLISH" : "UNPUBLISH", entity: "selection", entityId: selectionId });
  revalidatePath(`/admin/selections/convocation/${selectionId}`);
  revalidateTeam(t.code, t.slug);
  return { success: published ? "Liste publiée sur le portail." : "Liste retirée du portail." };
}
