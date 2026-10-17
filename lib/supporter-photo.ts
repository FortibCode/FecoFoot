import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supporters } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { deleteFile, putFile } from "@/lib/storage";

/**
 * Photo d'identité d'un supporter (EF-SUP-08) : JPEG, PNG ou WebP de 5 Mo au plus, type vérifié d'après le contenu.
 * Une nouvelle photo annule la vérification de la pièce : l'agent doit la comparer de nouveau.
 */
export async function saveSupporterPhoto(supporterId: number, file: FormDataEntryValue | null): Promise<{ error: string } | { ok: true }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une photo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) return { error: "La photo dépasse 5 Mo." };
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf") return { error: "Format non accepté : JPEG, PNG ou WebP." };

  const [s] = await db.select({ photoKey: supporters.photoKey }).from(supporters).where(eq(supporters.id, supporterId)).limit(1);
  if (!s) return { error: "Fan ID introuvable." };
  const key = `supporter/${supporterId}/${randomUUID()}.${kind}`;
  await putFile(key, bytes);
  await db.update(supporters).set({ photoKey: key, photoType: MIME[kind], idVerifiedAt: null }).where(eq(supporters.id, supporterId));
  if (s.photoKey) await deleteFile(s.photoKey);
  return { ok: true };
}

/** Adresse de la photo, avec une clé de version pour éviter une image périmée. */
export const supporterPhotoUrl = (s: { id: number; photoKey: string | null }) =>
  s.photoKey ? `/media/supporters/${s.id}?v=${s.photoKey.slice(-12, -5)}` : null;
