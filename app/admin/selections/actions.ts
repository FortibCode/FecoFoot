"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { intlCompetitions, intlGroupMatches, intlGroups, intlGroupTeams, matchStats, nationalEvents, nationalFixtures, nationalLineups, nationalStaff, nationalTeams, players, selectionPlayers, selections } from "@/lib/db/schema";
import { EVENT_TYPES, formationError } from "@/lib/competitions";
import { parseStats } from "@/lib/match-stats";
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

// ─── Compétitions internationales : groupes, journées, matchs des autres pays ──

const revalidateGroup = (code: string, slug?: string) => {
  revalidateTeam(code, slug);
  revalidatePath("/matchs", "layout");
};

const GroupSchema = z.object({
  competition: z.string().trim().min(3, { error: "Nom de la compétition requis." }).max(160),
  season: z.coerce.number().int().min(2000, { error: "Saison invalide." }).max(2100, { error: "Saison invalide." }),
  name: z.string().trim().min(1, { error: "Nom du groupe requis." }).max(80),
  qualifiers: z.coerce.number().int().min(0).max(10),
  countries: z.string().trim().min(2, { error: "Pays du groupe requis." }),
});

/** Nouveau groupe d'une compétition internationale (créée au besoin) ; le Congo en fait toujours partie. */
export async function createGroup(code: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  const parsed = GroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const g = parsed.data;
  const countries = [...new Set(["Congo", ...g.countries.split(/[,\n]/).map((c) => c.trim()).filter(Boolean)].map((c) => c.replace(/\s+/g, " ")))];
  if (countries.length < 2) return { error: "Un groupe compte au moins deux pays." };
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(intlCompetitions).where(and(eq(intlCompetitions.name, g.competition), eq(intlCompetitions.season, g.season))).limit(1);
      const competitionId = existing?.id ?? (await tx.insert(intlCompetitions).values({ name: g.competition, season: g.season }).returning({ id: intlCompetitions.id }))[0].id;
      const [group] = await tx.insert(intlGroups).values({ competitionId, teamId: t.id, name: g.name, qualifiers: g.qualifiers }).returning({ id: intlGroups.id });
      await tx.insert(intlGroupTeams).values(countries.map((country) => ({ groupId: group.id, country })));
      await logAudit({ userId: user.id, action: "CREATE", entity: "intl_group", entityId: group.id, details: { competition: g.competition, season: g.season, name: g.name, countries } });
    });
  } catch (e) {
    if (isUniqueViolation(e, "intl_groups_uq")) return { error: "Ce groupe existe déjà pour cette compétition." };
    throw e;
  }
  revalidateGroup(code, t.slug);
  return { success: "Groupe créé." };
}

export async function deleteGroup(code: string, groupId: number): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  await db.delete(intlGroups).where(and(eq(intlGroups.id, groupId), eq(intlGroups.teamId, t.id)));
  await logAudit({ userId: user.id, action: "DELETE", entity: "intl_group", entityId: groupId });
  revalidateGroup(code, t.slug);
  return { success: "Groupe supprimé." };
}

/** Match du Congo rattaché à un groupe et à une journée (classement et journées du groupe). */
export async function linkFixtureToGroup(code: string, fixtureId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  const groupId = Number(formData.get("groupId")) || null;
  const matchday = Number(formData.get("matchday")) || null;
  if (groupId) {
    const [g] = await db.select().from(intlGroups).where(and(eq(intlGroups.id, groupId), eq(intlGroups.teamId, t.id))).limit(1);
    if (!g) return { error: "Groupe introuvable." };
    if (!matchday || matchday < 1 || matchday > 20) return { error: "Journée requise (1 à 20)." };
  }
  await db
    .update(nationalFixtures)
    .set({ groupId, matchday: groupId ? matchday : null })
    .where(and(eq(nationalFixtures.id, fixtureId), eq(nationalFixtures.teamId, t.id)));
  await logAudit({ userId: user.id, action: "GROUP_LINK", entity: "national_fixture", entityId: fixtureId, details: { groupId, matchday } });
  revalidateGroup(code, t.slug);
  return { success: groupId ? "Match rattaché au groupe." : "Match détaché du groupe." };
}

const GroupMatchSchema = z.object({
  matchday: z.coerce.number().int().min(1, { error: "Journée requise." }).max(20),
  home: z.string().trim().min(2),
  away: z.string().trim().min(2),
  kickoffAt: z.preprocess(blankToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable()),
  venue: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
});

/** Match du groupe entre deux autres pays (le Congo a ses propres matchs dans le calendrier). */
export async function addGroupMatch(code: string, groupId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  const parsed = GroupMatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const m = parsed.data;
  if (m.home === m.away) return { error: "Choisissez deux pays différents." };
  if ([m.home, m.away].includes("Congo")) return { error: "Les matchs du Congo s'ajoutent au calendrier de la sélection, puis se rattachent au groupe." };
  const teams = (await db.select().from(intlGroupTeams).where(eq(intlGroupTeams.groupId, groupId))).map((r) => r.country);
  if (!teams.includes(m.home) || !teams.includes(m.away)) return { error: "Les deux pays doivent appartenir au groupe." };
  const [created] = await db
    .insert(intlGroupMatches)
    .values({ groupId, matchday: m.matchday, home: m.home, away: m.away, venue: m.venue, kickoffAt: m.kickoffAt ? new Date(`${m.kickoffAt}:00+01:00`) : null })
    .returning({ id: intlGroupMatches.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "intl_group_match", entityId: created.id, details: { groupId, ...m } });
  revalidateGroup(code, t.slug);
  return { success: "Match du groupe ajouté." };
}

/** Résultat d'un match entre deux autres pays du groupe. */
export async function setGroupMatchResult(code: string, matchId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  const parsed = z
    .object({
      status: z.enum(FIXTURE_STATUSES),
      homeGoals: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
      awayGoals: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(50).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Résultat invalide." };
  if (parsed.data.status === "PLAYED" && (parsed.data.homeGoals === null || parsed.data.awayGoals === null)) return { error: "Saisissez le score." };
  await db.update(intlGroupMatches).set(parsed.data).where(eq(intlGroupMatches.id, matchId));
  await logAudit({ userId: user.id, action: "RESULT", entity: "intl_group_match", entityId: matchId, details: parsed.data });
  revalidateGroup(code, t.slug);
  return { success: "Résultat enregistré." };
}

export async function deleteGroupMatch(code: string, matchId: number): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const t = await team(code);
  if (!t) return { error: "Sélection introuvable." };
  await db.delete(intlGroupMatches).where(eq(intlGroupMatches.id, matchId));
  await logAudit({ userId: user.id, action: "DELETE", entity: "intl_group_match", entityId: matchId });
  revalidateGroup(code, t.slug);
  return { success: "Match supprimé." };
}

// ─── Feuille de match des sélections : composition, événements, statistiques ──

const sheetPath = (code: string, fixtureId: number) => `/admin/selections/${code}/matchs/${fixtureId}`;

async function teamFixture(code: string, fixtureId: number) {
  const t = await team(code);
  if (!t) return null;
  const [f] = await db.select().from(nationalFixtures).where(and(eq(nationalFixtures.id, fixtureId), eq(nationalFixtures.teamId, t.id))).limit(1);
  return f ? { t, f } : null;
}

const revalidateSheet = (code: string, fixtureId: number, slug: string) => {
  revalidatePath(sheetPath(code, fixtureId));
  revalidatePath(`/matchs/selection/${fixtureId}`);
  revalidateTeam(code, slug);
};

/**
 * Composition du Congo parmi les convoqués : titulaires (11 au plus), remplaçants, numéros, postes, capitaine
 * (un titulaire) et système de jeu ; publiée sur la fiche du match quand le staff le décide.
 */
export async function saveNationalLineup(code: string, fixtureId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const tf = await teamFixture(code, fixtureId);
  if (!tf) return { error: "Match introuvable." };
  const ids = formData.getAll("entryIds").map(Number).filter(Number.isInteger);
  const called = ids.length ? await db.select().from(selectionPlayers).where(inArray(selectionPlayers.id, ids)) : [];
  const registered = called.map((c) => c.playerId).filter((id): id is number => id !== null);
  const names = new Map(
    (registered.length ? await db.select({ id: players.id, f: players.firstName, l: players.lastName }).from(players).where(inArray(players.id, registered)) : []).map((p) => [p.id, p]),
  );
  const rows = called.map((c) => {
    const p = c.playerId ? names.get(c.playerId) : undefined;
    const n = String(formData.get(`shirt_${c.id}`) ?? "").trim();
    const pos = String(formData.get(`pos_${c.id}`) ?? "");
    return {
      fixtureId,
      selectionPlayerId: c.id,
      playerId: c.playerId,
      name: p ? `${p.f} ${p.l}` : (c.externalName ?? "Joueur"),
      shirtNumber: n ? Number(n) : c.shirtNumber,
      position: (POSITIONS as readonly string[]).includes(pos) ? (pos as (typeof POSITIONS)[number]) : c.position,
      starter: formData.get(`starter_${c.id}`) === "on",
      captain: Number(formData.get("captainId")) === c.id,
    };
  });
  const starters = rows.filter((r) => r.starter);
  if (starters.length > 11) return { error: "Onze titulaires au plus." };
  if (rows.some((r) => r.captain && !r.starter)) return { error: "Le capitaine doit être l'un des titulaires." };
  const numbers = rows.map((r) => r.shirtNumber).filter((n): n is number => n !== null);
  if (new Set(numbers).size !== numbers.length) return { error: "Deux joueurs ont le même numéro." };
  const formation = String(formData.get("formation") ?? "").trim() || null;
  if (formation) {
    const err = formationError(formation);
    if (err) return { error: err };
  }
  const publish = formData.get("published") === "on";
  if (publish && starters.length !== 11) return { error: "Pour publier la composition, désignez les onze titulaires." };
  await db.transaction(async (tx) => {
    await tx.delete(nationalLineups).where(eq(nationalLineups.fixtureId, fixtureId));
    if (rows.length) await tx.insert(nationalLineups).values(rows);
    await tx.update(nationalFixtures).set({ formation, lineupPublished: publish }).where(eq(nationalFixtures.id, fixtureId));
  });
  await logAudit({ userId: user.id, action: "LINEUP", entity: "national_fixture", entityId: fixtureId, details: { players: rows.length, starters: starters.length, formation, published: publish } });
  revalidateSheet(code, fixtureId, tf.t.slug);
  return { success: publish ? "Composition enregistrée et publiée." : "Composition enregistrée (non publiée)." };
}

const NationalEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  minute: z.coerce.number().int().min(1, { error: "Minute de 1 à 130." }).max(130, { error: "Minute de 1 à 130." }),
  side: z.enum(["CONGO", "OPPONENT"]),
  player: z.string().trim().min(2, { error: "Joueur requis." }).max(160),
  secondPlayer: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
});

/** Événement d'un match des sélections : but (et passeur), carton, changement (joueur entrant). */
export async function addNationalEvent(code: string, fixtureId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const tf = await teamFixture(code, fixtureId);
  if (!tf) return { error: "Match introuvable." };
  const parsed = NationalEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.type === "SUBSTITUTION" && !parsed.data.secondPlayer) return { error: "Indiquez le joueur entrant." };
  const [created] = await db.insert(nationalEvents).values({ fixtureId, ...parsed.data }).returning({ id: nationalEvents.id });
  await logAudit({ userId: user.id, action: "MATCH_EVENT", entity: "national_fixture", entityId: fixtureId, details: { eventId: created.id, ...parsed.data } });
  revalidateSheet(code, fixtureId, tf.t.slug);
  return { success: "Événement ajouté." };
}

export async function deleteNationalEvent(code: string, fixtureId: number, eventId: number): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const tf = await teamFixture(code, fixtureId);
  if (!tf) return { error: "Match introuvable." };
  await db.delete(nationalEvents).where(and(eq(nationalEvents.id, eventId), eq(nationalEvents.fixtureId, fixtureId)));
  await logAudit({ userId: user.id, action: "MATCH_EVENT_DELETE", entity: "national_fixture", entityId: fixtureId, details: { eventId } });
  revalidateSheet(code, fixtureId, tf.t.slug);
  return { success: "Événement supprimé." };
}

/** Statistiques d'un match des sélections (total ou mi-temps), valeurs domicile / extérieur du match. */
export async function saveFixtureStats(code: string, fixtureId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("national_teams.manage");
  const tf = await teamFixture(code, fixtureId);
  if (!tf) return { error: "Match introuvable." };
  const parsed = parseStats(formData);
  if ("error" in parsed) return { error: parsed.error };
  await db
    .insert(matchStats)
    .values({ fixtureId, period: parsed.period, ...parsed.values })
    .onConflictDoUpdate({ target: [matchStats.fixtureId, matchStats.period], set: { ...parsed.values, updatedAt: new Date() } });
  await logAudit({ userId: user.id, action: "MATCH_STATS", entity: "national_fixture", entityId: fixtureId, details: { period: parsed.period, ...parsed.values } });
  revalidateSheet(code, fixtureId, tf.t.slug);
  return { success: "Statistiques enregistrées." };
}
