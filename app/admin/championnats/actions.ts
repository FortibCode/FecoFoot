"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, type CurrentUser } from "@/lib/auth/guard";
import { canAccessCompetition } from "@/lib/auth/roles";
import { divisionName, nextSeasonClubs, type TeamOutcome } from "@/lib/competitions";
import { db } from "@/lib/db";
import { championshipDocuments, championshipOfficials, championships, clubs, competitions, competitionTeams } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { imageSize } from "@/lib/image-size";
import { slugify } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { isUniqueViolation } from "@/lib/queries/players";
import { deleteFile, putFile } from "@/lib/storage";

/** Règlements et documents officiels : PDF de 10 Mo au plus. */
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const FORBIDDEN: ActionState = { error: "Les championnats nationaux sont gérés par la fédération." };

/** Championnats nationaux : fédération et gestion des compétitions, jamais un compte de ligue. */
const national = (user: CurrentUser) => canAccessCompetition(user, { leagueId: null });

async function loadChampionship(id: number) {
  const [ch] = await db.select().from(championships).where(eq(championships.id, id)).limit(1);
  return ch ?? null;
}

function revalidateChampionship(code: string) {
  revalidatePath("/admin/championnats");
  revalidatePath(`/admin/championnats/${code}`);
  revalidatePath("/championnats", "layout");
}

/** Présentation du championnat (le code, qui sert d'adresse publique, ne change pas). */
/** Logo officiel du championnat : JPEG, PNG ou WebP de 5 Mo au plus, type vérifié d'après le contenu. */
export async function uploadChampionshipLogo(championshipId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };
  if (file.size > MAX_FILE_SIZE) return { error: "L'image dépasse 5 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf" || !imageSize(bytes)) return { error: "Format non accepté : JPEG, PNG ou WebP." };
  const ch = await loadChampionship(championshipId);
  if (!ch) return { error: "Championnat introuvable." };
  const logoKey = `championships/${championshipId}/${randomUUID()}.${kind}`;
  await putFile(logoKey, bytes);
  await db.update(championships).set({ logoKey, logoType: MIME[kind], updatedAt: new Date() }).where(eq(championships.id, championshipId));
  if (ch.logoKey) await deleteFile(ch.logoKey);
  await logAudit({ userId: user.id, action: "LOGO", entity: "championship", entityId: championshipId });
  revalidateChampionship(ch.code);
  return { success: "Logo enregistré." };
}

export async function updateChampionship(championshipId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const parsed = z
    .object({
      name: z.string().trim().min(2, { error: "Nom requis." }).max(120),
      description: z.preprocess(blankToNull, z.string().trim().max(5000).nullable()),
      active: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const ch = await loadChampionship(championshipId);
  if (!ch) return { error: "Championnat introuvable." };
  await db
    .update(championships)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(championships.id, championshipId));
  await logAudit({ userId: user.id, action: "UPDATE", entity: "championship", entityId: championshipId, details: { name: parsed.data.name, active: parsed.data.active } });
  revalidateChampionship(ch.code);
  return { success: "Championnat mis à jour." };
}

/**
 * Nouvelle saison d'un championnat : une nouvelle compétition, les saisons précédentes restent intactes.
 * Le format (catégorie, barème, départage, aller-retour, montées et descentes) reprend celui de la saison
 * précédente et reste modifiable. Option : clubs proposés d'après les statuts sportifs de la saison précédente
 * (maintenus, promus du niveau inférieur, relégués du niveau supérieur).
 */
export async function createSeason(championshipId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const parsed = z
    .object({
      season: z.coerce.number({ error: "Saison requise." }).int().min(2000, { error: "Saison invalide." }).max(2100, { error: "Saison invalide." }),
      name: z.preprocess(blankToNull, z.string().trim().min(3).max(160).nullable()),
      carryClubs: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const { season, carryClubs } = parsed.data;
  const ch = await loadChampionship(championshipId);
  if (!ch) return { error: "Championnat introuvable." };

  const editions = await db.select().from(competitions).where(eq(competitions.championshipId, championshipId));
  const previous = editions.filter((e) => e.season < season).sort((a, b) => b.season - a.season)[0];
  const name = parsed.data.name ?? divisionName(ch.name);
  const slug = slugify(`${name} ${seasonLabel(season)}`);

  // Clubs proposés : à partir des statuts sportifs de la saison précédente, ici et aux niveaux voisins.
  let clubIds: number[] = [];
  if (carryClubs && previous) {
    const neighbours = await db
      .select({ id: competitions.id, tier: championships.tier })
      .from(competitions)
      .innerJoin(championships, eq(competitions.championshipId, championships.id))
      .where(and(eq(competitions.season, previous.season), inArray(championships.tier, [ch.tier - 1, ch.tier + 1])));
    const ids = [previous.id, ...neighbours.map((n) => n.id)];
    const teams = await db.select().from(competitionTeams).where(inArray(competitionTeams.competitionId, ids));
    const of = (competitionId: number | undefined) =>
      teams.filter((t) => t.competitionId === competitionId).map((t) => ({ clubId: t.clubId, outcome: t.outcome as TeamOutcome | null }));
    const lower = neighbours.find((n) => n.tier === ch.tier + 1)?.id;
    const upper = neighbours.find((n) => n.tier === ch.tier - 1)?.id;
    const proposed = nextSeasonClubs(of(previous.id), of(lower), of(upper));
    // Seuls les clubs encore affiliés sont repris.
    clubIds = proposed.length
      ? (await db.select({ id: clubs.id }).from(clubs).where(and(inArray(clubs.id, proposed), eq(clubs.status, "AFFILIATED")))).map((c) => c.id)
      : [];
  }

  let created: { id: number };
  try {
    created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(competitions)
        .values({
          name,
          slug,
          season,
          championshipId,
          type: "LEAGUE",
          category: previous?.category ?? "SENIOR",
          gender: previous?.gender ?? "M",
          doubleRound: previous?.doubleRound ?? true,
          pointsWin: previous?.pointsWin ?? 3,
          pointsDraw: previous?.pointsDraw ?? 1,
          pointsLoss: previous?.pointsLoss ?? 0,
          yellowCardThreshold: previous?.yellowCardThreshold ?? 3,
          ...(previous && { tiebreakers: previous.tiebreakers }),
          promotionSpots: previous?.promotionSpots ?? 0,
          relegationSpots: previous?.relegationSpots ?? 0,
        })
        .returning({ id: competitions.id });
      if (clubIds.length) await tx.insert(competitionTeams).values(clubIds.map((clubId) => ({ competitionId: row.id, clubId })));
      return row;
    });
  } catch (e) {
    if (isUniqueViolation(e, "competitions_championship_season_uq")) return { error: `La saison ${seasonLabel(season)} existe déjà pour ce championnat.` };
    if (isUniqueViolation(e, "competitions_slug_uq")) return { error: "Une compétition porte déjà ce nom pour cette saison : choisissez un autre nom." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "CREATE_SEASON", entity: "championship", entityId: championshipId, details: { season, competitionId: created.id, clubs: clubIds.length } });
  revalidateChampionship(ch.code);
  redirect(`/admin/competitions/${created.id}`);
}

const OfficialSchema = z.object({
  // Vide : responsable de la structure commune aux championnats nationaux.
  championshipId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  fullName: z.string().trim().min(3, { error: "Nom complet requis." }).max(160),
  position: z.string().trim().min(2, { error: "Fonction requise." }).max(120),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  phone: z.preprocess(blankToNull, z.string().trim().max(32).nullable()),
  startDate: z.iso.date({ error: "Date de début requise." }),
});

/** Responsable et sa fonction, avec la date de début de mandat. */
export async function addOfficial(code: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const parsed = OfficialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [row] = await db
    .insert(championshipOfficials)
    .values({ ...parsed.data, createdBy: user.id })
    .returning({ id: championshipOfficials.id });
  await logAudit({ userId: user.id, action: "OFFICIAL_ADD", entity: "championship_official", entityId: row.id, details: { fullName: parsed.data.fullName, position: parsed.data.position } });
  revalidateChampionship(code);
  return { success: "Responsable enregistré." };
}

/** Fin de mandat : le responsable passe dans l'historique, rien n'est effacé. */
export async function endMandate(code: string, officialId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const endDate = z.iso.date({ error: "Date de fin requise." }).safeParse(formData.get("endDate"));
  if (!endDate.success) return { error: "Date de fin requise." };
  const [o] = await db.select().from(championshipOfficials).where(eq(championshipOfficials.id, officialId)).limit(1);
  if (!o) return { error: "Responsable introuvable." };
  if (endDate.data < o.startDate) return { error: "La fin du mandat précède son début." };
  await db.update(championshipOfficials).set({ endDate: endDate.data, status: "ENDED" }).where(eq(championshipOfficials.id, officialId));
  await logAudit({ userId: user.id, action: "OFFICIAL_END", entity: "championship_official", entityId: officialId, details: { endDate: endDate.data } });
  revalidateChampionship(code);
  return { success: "Mandat clos : il reste dans l'historique." };
}

/** Suppression d'une saisie erronée (un mandat réel se clôt, il ne se supprime pas). */
export async function deleteOfficial(code: string, officialId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const [o] = await db.delete(championshipOfficials).where(eq(championshipOfficials.id, officialId)).returning();
  if (!o) return { error: "Responsable introuvable." };
  await logAudit({ userId: user.id, action: "OFFICIAL_DELETE", entity: "championship_official", entityId: officialId, details: { fullName: o.fullName, position: o.position } });
  revalidateChampionship(code);
  return { success: "Saisie supprimée." };
}

/** Document officiel ou règlement (PDF), pour une saison ou permanent. */
export async function uploadDocument(championshipId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const ch = await loadChampionship(championshipId);
  if (!ch) return { error: "Championnat introuvable." };
  const meta = z
    .object({
      title: z.string().trim().min(3, { error: "Titre requis." }).max(200),
      season: z.preprocess(blankToNull, z.coerce.number().int().min(2000).max(2100).nullable()),
    })
    .safeParse({ title: formData.get("title"), season: formData.get("season") });
  if (!meta.success) return fromZodError(meta.error);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier PDF." };
  if (file.size > MAX_DOCUMENT_SIZE) return { error: "Le document dépasse 10 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffKind(bytes) !== "pdf") return { error: "Format non accepté : PDF uniquement." };

  const storageKey = `championships/${championshipId}/${randomUUID()}.pdf`;
  await putFile(storageKey, bytes);
  const [doc] = await db
    .insert(championshipDocuments)
    .values({ championshipId, ...meta.data, storageKey, contentType: "application/pdf", size: bytes.length, createdBy: user.id })
    .returning({ id: championshipDocuments.id });
  await logAudit({ userId: user.id, action: "DOCUMENT_ADD", entity: "championship", entityId: championshipId, details: { documentId: doc.id, title: meta.data.title } });
  revalidateChampionship(ch.code);
  return { success: "Document publié." };
}

export async function deleteDocument(code: string, documentId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!national(user)) return FORBIDDEN;
  const [doc] = await db.delete(championshipDocuments).where(eq(championshipDocuments.id, documentId)).returning();
  if (!doc) return { error: "Document introuvable." };
  await deleteFile(doc.storageKey);
  await logAudit({ userId: user.id, action: "DOCUMENT_DELETE", entity: "championship", entityId: doc.championshipId, details: { title: doc.title } });
  revalidateChampionship(code);
  return { success: "Document supprimé." };
}
