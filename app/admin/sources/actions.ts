"use server";

import { and, eq, isNull, notExists } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { canAccessCompetition } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, competitions, externalConflicts, externalLinks, matches } from "@/lib/db/schema";
import { syncCompetition } from "@/lib/live-sync";
import { isUniqueViolation } from "@/lib/queries/players";

const PROVIDER = "API_FOOTBALL" as const;
const FORBIDDEN: ActionState = { error: "Les sources externes sont gérées par la fédération." };
const done = () => revalidatePath("/admin/sources");

/** Lie une compétition de la plateforme à une ligue et une saison du fournisseur. */
export async function linkCompetition(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  const parsed = z
    .object({
      competitionId: z.coerce.number({ error: "Choisissez une compétition." }).int().positive({ error: "Choisissez une compétition." }),
      leagueId: z.coerce.number({ error: "Identifiant de ligue requis." }).int().positive({ error: "Identifiant de ligue requis." }),
      season: z.coerce.number({ error: "Saison requise." }).int().min(2000).max(2100),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [c] = await db.select().from(competitions).where(eq(competitions.id, parsed.data.competitionId)).limit(1);
  if (!c) return { error: "Compétition introuvable." };
  try {
    await db.insert(externalLinks).values({
      provider: PROVIDER,
      entity: "competition",
      entityId: c.id,
      externalId: String(parsed.data.leagueId),
      externalSeason: parsed.data.season,
      createdBy: user.id,
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Cette compétition ou cette ligue/saison est déjà liée." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "EXTERNAL_LINK", entity: "competition", entityId: c.id, details: { provider: PROVIDER, ...parsed.data } });
  done();
  return { success: `« ${c.name} » liée à la ligue ${parsed.data.leagueId} (saison ${parsed.data.season}).` };
}

export async function unlinkCompetition(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  await db.delete(externalLinks).where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "competition"), eq(externalLinks.entityId, competitionId)));
  await logAudit({ userId: user.id, action: "EXTERNAL_UNLINK", entity: "competition", entityId: competitionId });
  done();
  return { success: "Lien supprimé : les matchs déjà importés sont conservés." };
}

/** Associe une équipe du fournisseur à un club de la plateforme (jamais de création automatique de club). */
export async function linkClub(externalTeamId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  const clubId = Number(formData.get("clubId"));
  if (!Number.isInteger(clubId) || clubId <= 0) return { error: "Choisissez un club." };
  const [club] = await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) return { error: "Club introuvable." };
  // Remplace une association précédente de cette équipe ou de ce club.
  await db.delete(externalLinks).where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "club"), eq(externalLinks.externalId, String(externalTeamId))));
  await db.delete(externalLinks).where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "club"), eq(externalLinks.entityId, clubId)));
  await db.insert(externalLinks).values({ provider: PROVIDER, entity: "club", entityId: clubId, externalId: String(externalTeamId), createdBy: user.id });
  await logAudit({ userId: user.id, action: "EXTERNAL_LINK", entity: "club", entityId: clubId, details: { provider: PROVIDER, externalTeamId } });
  done();
  return { success: `Associée à ${club.name}.` };
}

/** Synchronisation à la demande (en plus de l'appel planifié). */
export async function syncNow(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  const r = await syncCompetition(competitionId, "manual");
  await logAudit({ userId: user.id, action: "EXTERNAL_SYNC", entity: "competition", entityId: competitionId, details: { runId: r.runId, created: r.created, updated: r.updated, conflicts: r.conflicts, error: r.error } });
  done();
  revalidatePath("/", "layout");
  if (r.error) return { error: r.error };
  return { success: `Synchronisé : ${r.created} match(s) créé(s), ${r.updated} mis à jour, ${r.conflicts} conflit(s), ${r.skipped} ignoré(s).${r.notes.length ? ` ${r.notes.join(" ")}` : ""}` };
}

/**
 * Décision de la fédération : les résultats terminés importés d'une compétition deviennent officiels
 * et comptent au classement (saison passée importée, ou résultats vérifiés). Un match en conflit ouvert
 * n'est pas validé ; chaque résultat reste corrigeable depuis sa feuille de match.
 */
export async function validateExternalResults(competitionId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  const openConflict = db
    .select({ id: externalConflicts.id })
    .from(externalConflicts)
    .where(and(eq(externalConflicts.matchId, matches.id), isNull(externalConflicts.resolvedAt)));
  const validated = await db
    .update(matches)
    .set({ validatedAt: new Date(), validatedBy: user.id })
    .where(and(eq(matches.competitionId, competitionId), eq(matches.status, "FINISHED"), eq(matches.scoreSource, "EXTERNAL"), isNull(matches.validatedAt), notExists(openConflict)))
    .returning({ id: matches.id });
  if (!validated.length) return { error: "Aucun résultat externe terminé à valider." };
  await logAudit({ userId: user.id, action: "EXTERNAL_RESULTS_VALIDATED", entity: "competition", entityId: competitionId, details: { provider: PROVIDER, count: validated.length } });
  done();
  revalidatePath("/", "layout");
  return { success: `${validated.length} résultat(s) validé(s) : ils comptent désormais au classement.` };
}

/** Conflit examiné : la donnée officielle est conservée (une correction se fait sur la feuille de match). */
export async function resolveConflict(conflictId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) return FORBIDDEN;
  const updated = await db
    .update(externalConflicts)
    .set({ resolvedAt: new Date(), resolvedBy: user.id, resolution: "KEEP_OFFICIAL" })
    .where(eq(externalConflicts.id, conflictId))
    .returning({ matchId: externalConflicts.matchId });
  if (!updated.length) return { error: "Conflit introuvable." };
  await logAudit({ userId: user.id, action: "EXTERNAL_CONFLICT_RESOLVED", entity: "match", entityId: updated[0].matchId, details: { conflictId, resolution: "KEEP_OFFICIAL" } });
  done();
  return { success: "Conflit examiné : la donnée officielle est conservée." };
}
