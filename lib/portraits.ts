import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_FILE_SIZE, sniffKind } from "@/lib/documents";
import { imageSize } from "@/lib/image-size";
import { putFile } from "@/lib/storage";

/**
 * Portrait envoyé par un formulaire (champ `photo`) : JPEG, PNG ou WebP de 5 Mo au plus, enregistré sous
 * `<dossier>/<id>/…`. Sans fichier : `null` (le portrait existant est conservé).
 */
export async function savePortrait(file: FormDataEntryValue | null, folder: string, id: number): Promise<{ key: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) return { error: "La photo dépasse 5 Mo." };
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf" || !imageSize(bytes)) return { error: "Format non accepté : JPEG, PNG ou WebP." };
  const key = `${folder}/${id}/${randomUUID()}.${kind}`;
  await putFile(key, bytes);
  return { key };
}

/** Type MIME d'un portrait d'après l'extension de sa clé de stockage. */
export const portraitType = (key: string) => ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[key.split(".").pop() ?? ""] ?? "application/octet-stream";
