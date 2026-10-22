"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guard";
import { can, canManageLeague } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { leagues } from "@/lib/db/schema";
import { deleteLeagueRecord, leagueBlockers } from "@/lib/deletion";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { imageSize } from "@/lib/image-size";
import { isUniqueViolation } from "@/lib/queries/players";
import { deleteFile, putFile } from "@/lib/storage";

/** Fiche gérée par la fédération : identité de la ligue (code, nom, département). */
const IdentitySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,8}$/, { error: "Code de 2 à 8 lettres (ex. BZV)." }),
  name: z.string().trim().min(3, { error: "Nom de la ligue requis." }).max(120),
  department: z.preprocess(blankToNull, z.string().trim().max(80).nullable()),
});

/** Informations que le responsable départemental tient à jour lui-même. */
const InfoSchema = z.object({
  description: z.preprocess(blankToNull, z.string().trim().max(3000).nullable()),
  president: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  phone: z.preprocess(blankToNull, z.string().trim().max(32).nullable()),
});

const LeagueSchema = IdentitySchema.extend(InfoSchema.shape);

const CODE_TAKEN: ActionState = { error: "Ce code est déjà utilisé par une autre ligue.", fieldErrors: { code: ["Code déjà utilisé."] } };
const OUT_OF_SCOPE: ActionState = { error: "Cette ligue n'est pas dans votre périmètre." };

function revalidateLeague(id: number) {
  revalidatePath("/admin/ligues");
  revalidatePath(`/admin/ligues/${id}`);
  revalidatePath("/ligues", "layout");
}

/** Création d'une ligue (EF-CLB-01) : le code court sert d'identifiant dans les listes, les exports et le portail. */
export async function createLeague(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leagues.manage");
  const parsed = LeagueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  let id: number;
  try {
    [{ id }] = await db.insert(leagues).values(parsed.data).returning({ id: leagues.id });
  } catch (e) {
    if (isUniqueViolation(e, "leagues_code_uq")) return CODE_TAKEN;
    throw e;
  }
  await logAudit({ userId: user.id, action: "CREATE", entity: "league", entityId: id, details: { code: parsed.data.code, name: parsed.data.name } });
  revalidateLeague(id);
  redirect(`/admin/ligues/${id}`);
}

/**
 * Modification d'une ligue. La fédération modifie tout ; le responsable départemental
 * ne met à jour que la présentation et les coordonnées de sa propre ligue.
 */
export async function updateLeague(leagueId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("leagues.manage", "leagues.own");
  if (!canManageLeague(user, leagueId)) return OUT_OF_SCOPE;
  const federation = can(user.role, "leagues.manage");
  const parsed = (federation ? LeagueSchema : InfoSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  let updated: { id: number }[];
  try {
    updated = await db
      .update(leagues)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(leagues.id, leagueId))
      .returning({ id: leagues.id });
  } catch (e) {
    if (isUniqueViolation(e, "leagues_code_uq")) return CODE_TAKEN;
    throw e;
  }
  if (updated.length === 0) return { error: "Ligue introuvable." };

  await logAudit({ userId: user.id, action: "UPDATE", entity: "league", entityId: leagueId, details: { fields: Object.keys(parsed.data) } });
  revalidateLeague(leagueId);
  return { success: "Ligue mise à jour." };
}

/** Logo de la ligue : JPEG, PNG ou WebP de 5 Mo au plus, type vérifié d'après le contenu. */
export async function uploadLeagueLogo(leagueId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("leagues.manage", "leagues.own");
  if (!canManageLeague(user, leagueId)) return OUT_OF_SCOPE;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };
  if (file.size > MAX_FILE_SIZE) return { error: "L'image dépasse 5 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf" || !imageSize(bytes)) return { error: "Format non accepté : JPEG, PNG ou WebP." };

  const [league] = await db.select({ logoKey: leagues.logoKey }).from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return { error: "Ligue introuvable." };
  const logoKey = `leagues/${leagueId}/${randomUUID()}.${kind}`;
  await putFile(logoKey, bytes);
  await db.update(leagues).set({ logoKey, logoType: MIME[kind], updatedAt: new Date() }).where(eq(leagues.id, leagueId));
  if (league.logoKey) await deleteFile(league.logoKey);
  await logAudit({ userId: user.id, action: "LOGO", entity: "league", entityId: leagueId });
  revalidateLeague(leagueId);
  return { success: "Logo enregistré." };
}

/**
 * Activation / désactivation : une ligue désactivée disparaît du portail et ne reçoit plus
 * de nouveaux clubs ni de nouvelles compétitions ; ses clubs, matchs et résultats restent intacts.
 */
export async function setLeagueActive(leagueId: number, active: boolean): Promise<ActionState> {
  const user = await requirePermission("leagues.manage");
  const updated = await db.update(leagues).set({ active, updatedAt: new Date() }).where(eq(leagues.id, leagueId)).returning({ name: leagues.name });
  if (updated.length === 0) return { error: "Ligue introuvable." };
  await logAudit({ userId: user.id, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "league", entityId: leagueId });
  revalidateLeague(leagueId);
  return { success: active ? `Ligue « ${updated[0].name} » réactivée.` : `Ligue « ${updated[0].name} » désactivée : son historique est conservé.` };
}

/** Suppression définitive refusée dès qu'un club, un compte, un arbitre ou une compétition y est rattaché : désactiver plutôt. */
export async function deleteLeague(leagueId: number): Promise<ActionState> {
  const user = await requirePermission("leagues.manage");
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return { error: "Ligue introuvable." };
  const reasons = await leagueBlockers(leagueId);
  if (reasons.length) return { error: `Suppression impossible : ${reasons.join(" ; ")}. Désactivez la ligue pour conserver son historique.` };
  await deleteLeagueRecord(leagueId);
  if (league.logoKey) await deleteFile(league.logoKey);
  await logAudit({ userId: user.id, action: "DELETE", entity: "league", entityId: leagueId, details: { code: league.code, name: league.name } });
  revalidateLeague(leagueId);
  return { success: `Ligue « ${league.name} » supprimée.` };
}
