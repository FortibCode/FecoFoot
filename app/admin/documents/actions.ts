"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { checkUpload, DOCUMENT_TYPE_KEYS, DOCUMENT_TYPES, MIME, type DocumentOwner } from "@/lib/documents";
import { canManageDocuments } from "@/lib/queries/documents";
import { deleteFile, putFile } from "@/lib/storage";

const ownerPath = (ownerType: DocumentOwner, ownerId: number) =>
  ownerType === "player" ? `/admin/joueurs/${ownerId}` : `/admin/clubs/${ownerId}`;

export async function uploadDocument(
  ownerType: DocumentOwner,
  ownerId: number,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!(await canManageDocuments(user, ownerType, ownerId))) return { error: "Vous n'avez pas le droit d'ajouter une pièce ici." };

  const type = z.enum(DOCUMENT_TYPE_KEYS as [string, ...string[]]).safeParse(formData.get("type"));
  if (!type.success || DOCUMENT_TYPES[type.data as keyof typeof DOCUMENT_TYPES].owner !== ownerType) {
    return { error: "Type de pièce invalide." };
  }
  const docType = type.data as keyof typeof DOCUMENT_TYPES;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(docType, bytes);
  if ("error" in checked) return { error: checked.error };

  const storageKey = `${ownerType}/${ownerId}/${randomUUID()}.${checked.kind}`;
  await putFile(storageKey, bytes);
  const [created] = await db
    .insert(documents)
    .values({
      ownerType,
      ownerId,
      type: docType,
      storageKey,
      originalName: file.name.slice(0, 255) || `${docType}.${checked.kind}`,
      contentType: MIME[checked.kind],
      size: bytes.length,
      uploadedBy: user.id,
    })
    .returning({ id: documents.id });

  await logAudit({ userId: user.id, action: "UPLOAD", entity: "document", entityId: created.id, details: { ownerType, ownerId, type: docType } });
  revalidatePath(ownerPath(ownerType, ownerId));
  return { success: `${DOCUMENT_TYPES[docType].label} enregistré(e).` };
}

export async function deleteDocument(documentId: number): Promise<void> {
  const user = await requireUser();
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc || !(await canManageDocuments(user, doc.ownerType, doc.ownerId))) return;

  await db.delete(documents).where(eq(documents.id, documentId));
  await deleteFile(doc.storageKey);
  await logAudit({
    userId: user.id,
    action: "DELETE",
    entity: "document",
    entityId: documentId,
    details: { ownerType: doc.ownerType, ownerId: doc.ownerId, type: doc.type, originalName: doc.originalName },
  });
  revalidatePath(ownerPath(doc.ownerType, doc.ownerId));
}
