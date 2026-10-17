"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { competitionTeams, disciplineCaseSeq, disciplineCases, players } from "@/lib/db/schema";
import { decisionError, formatCaseNumber, SANCTION_TYPES } from "@/lib/discipline";
import { seasonOf } from "@/lib/licenses";
import { nextVal } from "@/lib/sequences";

const optionalId = z.preprocess(blankToNull, z.coerce.number().int().positive().nullable());

/** Ouverture d'un dossier disciplinaire : joueur (identifiant fédéral) et / ou club, compétition, faits. */
export async function openCase(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discipline.manage");
  const parsed = z
    .object({
      federalId: z.preprocess(blankToNull, z.string().trim().toUpperCase().nullable()),
      clubId: optionalId,
      competitionId: optionalId,
      facts: z.string().trim().min(10, { error: "Décrivez les faits (10 caractères minimum)." }).max(5000),
      hearingAt: z.preprocess(blankToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  let playerId: number | null = null;
  let clubId = d.clubId;
  if (d.federalId) {
    const [p] = await db.select({ id: players.id, clubId: players.clubId }).from(players).where(eq(players.federalId, d.federalId)).limit(1);
    if (!p) return { error: `Aucun joueur avec l'identifiant ${d.federalId}.` };
    playerId = p.id;
    clubId ??= p.clubId;
  }
  if (!playerId && !clubId) return { error: "Le dossier doit viser un joueur ou un club." };

  const [created] = await db
    .insert(disciplineCases)
    .values({
      number: formatCaseNumber(seasonOf(), await nextVal(disciplineCaseSeq)),
      playerId,
      clubId,
      competitionId: d.competitionId,
      facts: d.facts,
      hearingAt: d.hearingAt ? new Date(`${d.hearingAt}:00+01:00`) : null,
      createdBy: user.id,
    })
    .returning({ id: disciplineCases.id, number: disciplineCases.number });
  await logAudit({ userId: user.id, action: "CREATE", entity: "discipline_case", entityId: created.id, details: { number: created.number, playerId, clubId } });
  redirect(`/admin/discipline/${created.id}`);
}

/** Décision de la commission (EF-DIS-01). Un retrait de points s'applique immédiatement au classement. */
export async function decideCase(caseId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discipline.manage");
  const parsed = z
    .object({
      sanctionType: z.enum(SANCTION_TYPES, { error: "Type de sanction requis." }),
      decision: z.string().trim().min(10, { error: "Rédigez la décision (motivation)." }).max(5000),
      suspensionMatches: optionalId,
      suspensionUntil: z.preprocess(blankToNull, z.iso.date().nullable()),
      fineAmount: optionalId,
      pointsDeducted: optionalId,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const [c] = await db.select().from(disciplineCases).where(eq(disciplineCases.id, caseId)).limit(1);
  if (!c) return { error: "Dossier introuvable." };
  if (c.status !== "OPEN") return { error: "Une décision a déjà été rendue." };
  const suspensionUntil = d.suspensionUntil ? new Date(`${d.suspensionUntil}T00:00:00Z`) : null;
  const problem = decisionError({ type: d.sanctionType, playerId: c.playerId, clubId: c.clubId, competitionId: c.competitionId, suspensionMatches: d.suspensionMatches, suspensionUntil, fineAmount: d.fineAmount, pointsDeducted: d.pointsDeducted });
  if (problem) return { error: problem };

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(disciplineCases)
      .set({
        status: "DECIDED",
        decision: d.decision,
        sanctionType: d.sanctionType,
        suspensionMatches: d.sanctionType === "MATCH_SUSPENSION" ? d.suspensionMatches : null,
        suspensionUntil: d.sanctionType === "TIME_SUSPENSION" ? suspensionUntil : null,
        fineAmount: d.sanctionType === "FINE" ? d.fineAmount : null,
        pointsDeducted: d.sanctionType === "POINTS_DEDUCTION" ? d.pointsDeducted : null,
        decidedAt: new Date(),
        decidedBy: user.id,
      })
      .where(and(eq(disciplineCases.id, caseId), eq(disciplineCases.status, "OPEN")))
      .returning({ id: disciplineCases.id });
    if (updated.length === 0) throw new Error("Décision déjà rendue.");
    if (d.sanctionType === "POINTS_DEDUCTION") {
      await tx
        .update(competitionTeams)
        .set({
          pointsPenalty: sql`${competitionTeams.pointsPenalty} + ${d.pointsDeducted!}`,
          penaltyReason: sql`trim(both ' ;' from coalesce(${competitionTeams.penaltyReason}, '') || '; ' || ${`décision ${c.number}`})`,
        })
        .where(and(eq(competitionTeams.competitionId, c.competitionId!), eq(competitionTeams.clubId, c.clubId!)));
    }
  });
  await logAudit({ userId: user.id, action: "DISCIPLINE_DECISION", entity: "discipline_case", entityId: caseId, details: { sanctionType: d.sanctionType } });
  revalidatePath(`/admin/discipline/${caseId}`);
  revalidatePath("/admin/discipline");
  if (c.competitionId) revalidatePath(`/admin/competitions/${c.competitionId}`);
  return { success: "Décision enregistrée." };
}

export async function dismissCase(caseId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("discipline.manage");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Indiquez le motif du classement sans suite." };
  await db.update(disciplineCases).set({ status: "CLOSED", decision: reason, decidedAt: new Date(), decidedBy: user.id }).where(and(eq(disciplineCases.id, caseId), eq(disciplineCases.status, "OPEN")));
  await logAudit({ userId: user.id, action: "DISCIPLINE_DISMISSED", entity: "discipline_case", entityId: caseId });
  revalidatePath(`/admin/discipline/${caseId}`);
  return { success: "Dossier classé sans suite." };
}

/** Publication des décisions sur le portail (EF-DIS-01). */
export async function setCasePublished(caseId: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("discipline.manage");
  const [c] = await db.select({ status: disciplineCases.status }).from(disciplineCases).where(eq(disciplineCases.id, caseId)).limit(1);
  if (c?.status !== "DECIDED") return { error: "Seule une décision rendue peut être publiée." };
  await db.update(disciplineCases).set({ publishedAt: published ? new Date() : null }).where(eq(disciplineCases.id, caseId));
  await logAudit({ userId: user.id, action: published ? "PUBLISH" : "UNPUBLISH", entity: "discipline_case", entityId: caseId });
  revalidatePath(`/admin/discipline/${caseId}`);
  revalidatePath("/discipline");
  return { success: published ? "Décision publiée." : "Décision retirée du portail." };
}

