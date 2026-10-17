"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams, photos } from "@/lib/db/schema";
import { storePhoto } from "@/lib/photos";
import { deleteFile } from "@/lib/storage";

const Caption = z.string().trim().max(200, { error: "Légende trop longue (200 caractères)." });
const TeamId = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());

function refresh() {
  revalidatePath("/admin/photos");
  revalidatePath("/", "layout");
}

async function teamExists(teamId: number | null) {
  if (teamId === null) return true;
  return (await db.$count(nationalTeams, eq(nationalTeams.id, teamId))) > 0;
}

/** Téléversement d'une photo (le formulaire envoie les fichiers un par un). */
export async function uploadPhoto(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une photo." };
  const caption = Caption.safeParse(formData.get("caption") ?? "");
  const teamId = TeamId.safeParse(formData.get("teamId"));
  if (!caption.success) return { error: caption.error.issues[0]?.message };
  if (!teamId.success || !(await teamExists(teamId.data))) return { error: "Sélection inconnue." };

  const result = await storePhoto({ bytes: new Uint8Array(await file.arrayBuffer()), teamId: teamId.data, caption: caption.data, createdBy: user.id });
  if ("error" in result) return { error: `${file.name} : ${result.error}` };
  await logAudit({ userId: user.id, action: "CREATE", entity: "photo", entityId: result.photo.id, details: { teamId: teamId.data, name: file.name } });
  refresh();
  return { success: "Photo ajoutée." };
}

/** Légende et sélection d'une photo. */
export async function updatePhoto(photoId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const caption = Caption.safeParse(formData.get("caption") ?? "");
  const teamId = TeamId.safeParse(formData.get("teamId"));
  if (!caption.success) return { error: caption.error.issues[0]?.message };
  if (!teamId.success || !(await teamExists(teamId.data))) return { error: "Sélection inconnue." };
  const updated = await db.update(photos).set({ caption: caption.data, teamId: teamId.data }).where(eq(photos.id, photoId)).returning({ id: photos.id });
  if (updated.length === 0) return { error: "Photo introuvable." };
  await logAudit({ userId: user.id, action: "UPDATE", entity: "photo", entityId: photoId, details: { caption: caption.data, teamId: teamId.data } });
  refresh();
  return { success: "Enregistré." };
}

/** Publication sur le portail, ou mise en avant dans le bandeau d'accueil. */
export async function setPhotoFlag(photoId: number, flag: "published" | "featured", value: boolean): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  // Plusieurs photos peuvent être à la une : elles défilent dans le bandeau d'accueil (les plus récentes d'abord).
  await db
    .update(photos)
    .set(flag === "featured" ? { featured: value, ...(value && { published: true }) } : { published: value, ...(!value && { featured: false }) })
    .where(eq(photos.id, photoId));
  await logAudit({ userId: user.id, action: `PHOTO_${flag.toUpperCase()}`, entity: "photo", entityId: photoId, details: { value } });
  refresh();
  return { success: "Enregistré." };
}

export async function deletePhoto(photoId: number): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const [p] = await db.delete(photos).where(eq(photos.id, photoId)).returning({ storageKey: photos.storageKey });
  if (!p) return { error: "Photo introuvable." };
  await deleteFile(p.storageKey);
  await logAudit({ userId: user.id, action: "DELETE", entity: "photo", entityId: photoId });
  refresh();
  return { success: "Photo supprimée." };
}
