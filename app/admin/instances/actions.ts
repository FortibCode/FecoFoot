"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { governanceBodies, governanceMembers } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { GOVERNANCE_BODY_KINDS } from "@/lib/governance";
import { isUniqueViolation } from "@/lib/queries/players";
import { savePortrait } from "@/lib/portraits";
import { deleteFile } from "@/lib/storage";

const done = (bodyId?: number) => {
  revalidatePath("/admin/instances");
  if (bodyId) revalidatePath(`/admin/instances/${bodyId}`);
  revalidatePath("/federation");
};

const BodySchema = z.object({
  name: z.string().trim().min(3, { error: "Nom requis." }).max(160),
  kind: z.enum(GOVERNANCE_BODY_KINDS, { error: "Type requis." }),
  description: z.preprocess(blankToNull, z.string().trim().max(3000).nullable()),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  published: z.preprocess((v) => v === "on", z.boolean()),
});

/** Nouvelle instance (Comex, commission…) ; publiée sur la page « La Fédération » si cochée. */
export async function createBody(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const parsed = BodySchema.safeParse({ ...Object.fromEntries(formData), published: formData.get("published") ?? "on" });
  if (!parsed.success) return fromZodError(parsed.error);
  let id: number;
  try {
    [{ id }] = await db
      .insert(governanceBodies)
      .values({ ...parsed.data, slug: slugify(parsed.data.name) })
      .returning({ id: governanceBodies.id });
  } catch (e) {
    if (isUniqueViolation(e, "governance_bodies_slug_uq")) return { error: "Une instance porte déjà ce nom." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "CREATE", entity: "governance_body", entityId: id, details: { name: parsed.data.name, kind: parsed.data.kind } });
  done();
  redirect(`/admin/instances/${id}`);
}

export async function updateBody(bodyId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const parsed = BodySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const updated = await db
      .update(governanceBodies)
      .set({ ...parsed.data, slug: slugify(parsed.data.name), updatedAt: new Date() })
      .where(eq(governanceBodies.id, bodyId))
      .returning({ id: governanceBodies.id });
    if (!updated.length) return { error: "Instance introuvable." };
  } catch (e) {
    if (isUniqueViolation(e, "governance_bodies_slug_uq")) return { error: "Une instance porte déjà ce nom." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "UPDATE", entity: "governance_body", entityId: bodyId, details: { name: parsed.data.name } });
  done(bodyId);
  return { success: "Instance mise à jour." };
}

/** Suppression d'une instance créée par erreur ; refusée si elle a des membres (historique des mandats). */
export async function deleteBody(bodyId: number): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const [{ n }] = await db.select({ n: count() }).from(governanceMembers).where(eq(governanceMembers.bodyId, bodyId));
  if (n > 0) return { error: `Cette instance a ${n} membre(s) enregistré(s), y compris dans l'historique : retirez-la de la page publique au lieu de la supprimer.` };
  const [b] = await db.delete(governanceBodies).where(eq(governanceBodies.id, bodyId)).returning();
  if (!b) return { error: "Instance introuvable." };
  await logAudit({ userId: user.id, action: "DELETE", entity: "governance_body", entityId: bodyId, details: { name: b.name } });
  done();
  return { success: "Instance supprimée." };
}

const MemberSchema = z.object({
  fullName: z.string().trim().min(3, { error: "Nom complet requis." }).max(160),
  position: z.string().trim().min(2, { error: "Fonction requise." }).max(120),
  startDate: z.preprocess(blankToNull, z.iso.date({ error: "Date invalide." }).nullable()),
  source: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
});

/** Membre et sa fonction ; date de début et texte de référence facultatifs. */
export async function addMember(bodyId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const parsed = MemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [row] = await db
    .insert(governanceMembers)
    .values({ ...parsed.data, bodyId, createdBy: user.id })
    .returning({ id: governanceMembers.id });
  await logAudit({ userId: user.id, action: "GOVERNANCE_MEMBER_ADD", entity: "governance_member", entityId: row.id, details: { bodyId, fullName: parsed.data.fullName, position: parsed.data.position } });
  done(bodyId);
  return { success: "Membre enregistré." };
}

/** Fin de mandat : le membre passe dans l'historique, rien n'est effacé. */
export async function endMemberMandate(bodyId: number, memberId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const endDate = z.iso.date().safeParse(formData.get("endDate"));
  if (!endDate.success) return { error: "Date de fin requise." };
  const [m] = await db.select().from(governanceMembers).where(and(eq(governanceMembers.id, memberId), eq(governanceMembers.bodyId, bodyId))).limit(1);
  if (!m) return { error: "Membre introuvable." };
  if (m.startDate && endDate.data < m.startDate) return { error: "La fin du mandat précède son début." };
  await db.update(governanceMembers).set({ endDate: endDate.data, status: "ENDED" }).where(eq(governanceMembers.id, memberId));
  await logAudit({ userId: user.id, action: "GOVERNANCE_MANDATE_END", entity: "governance_member", entityId: memberId, details: { endDate: endDate.data } });
  done(bodyId);
  return { success: "Mandat clos : il reste dans l'historique." };
}

/** Suppression d'une saisie erronée (un mandat réel se clôt, il ne se supprime pas). */
export async function deleteMember(bodyId: number, memberId: number): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const [m] = await db
    .delete(governanceMembers)
    .where(and(eq(governanceMembers.id, memberId), eq(governanceMembers.bodyId, bodyId)))
    .returning();
  if (!m) return { error: "Membre introuvable." };
  if (m.photoKey) await deleteFile(m.photoKey).catch(() => undefined);
  await logAudit({ userId: user.id, action: "GOVERNANCE_MEMBER_DELETE", entity: "governance_member", entityId: memberId, details: { fullName: m.fullName, position: m.position } });
  done(bodyId);
  return { success: "Saisie supprimée." };
}

/** Portrait officiel d'un membre (page « La Fédération ») : image et crédit obligatoire. */
export async function setMemberPhoto(bodyId: number, memberId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("governance.manage");
  const [m] = await db.select().from(governanceMembers).where(and(eq(governanceMembers.id, memberId), eq(governanceMembers.bodyId, bodyId))).limit(1);
  if (!m) return { error: "Membre introuvable." };
  const credit = String(formData.get("credit") ?? "").trim();
  if (credit.length < 2 || credit.length > 240) return { error: "Crédit requis.", fieldErrors: { credit: ["Auteur ou source de la photo (240 caractères au plus)."] } };
  const saved = await savePortrait(formData.get("photo"), "membres", memberId);
  if (saved && "error" in saved) return { error: saved.error, fieldErrors: { photo: [saved.error] } };
  // Sans nouveau fichier : mise à jour du crédit seul.
  if (!saved && !m.photoKey) return { error: "Choisissez une photo.", fieldErrors: { photo: ["Photo requise."] } };
  await db
    .update(governanceMembers)
    .set({ photoCredit: credit, ...(saved ? { photoKey: saved.key } : {}) })
    .where(eq(governanceMembers.id, memberId));
  if (saved && m.photoKey) await deleteFile(m.photoKey).catch(() => undefined);
  await logAudit({ userId: user.id, action: "UPDATE", entity: "governance_member", entityId: memberId, details: { photo: true } });
  done(bodyId);
  return { success: "Photo enregistrée." };
}

export async function removeMemberPhoto(bodyId: number, memberId: number): Promise<void> {
  const user = await requirePermission("governance.manage");
  const [m] = await db.select().from(governanceMembers).where(and(eq(governanceMembers.id, memberId), eq(governanceMembers.bodyId, bodyId))).limit(1);
  if (!m?.photoKey) return;
  await db.update(governanceMembers).set({ photoKey: null, photoCredit: null }).where(eq(governanceMembers.id, memberId));
  await deleteFile(m.photoKey).catch(() => undefined);
  await logAudit({ userId: user.id, action: "UPDATE", entity: "governance_member", entityId: memberId, details: { photo: false } });
  done(bodyId);
}
