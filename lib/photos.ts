import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { nationalTeams, photos } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { imageSize } from "@/lib/image-size";
import { putFile } from "@/lib/storage";

/** Adresse publique d'une photo, avec une clé de version (mise en cache longue sans image périmée). */
export const photoUrl = (p: { id: number; storageKey: string }) => `/media/photos/${p.id}?v=${p.storageKey.slice(-12, -5)}`;

/**
 * Enregistre une photo de la photothèque : JPEG, PNG ou WebP de 5 Mo au plus,
 * type vérifié d'après le contenu, dimensions lues dans l'en-tête.
 */
export async function storePhoto(input: { bytes: Uint8Array; teamId: number | null; caption: string; createdBy: number | null }) {
  const { bytes } = input;
  if (bytes.length === 0) return { error: "Le fichier est vide." } as const;
  if (bytes.length > MAX_FILE_SIZE) return { error: "La photo dépasse 5 Mo." } as const;
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf") return { error: "Format non accepté : JPEG, PNG ou WebP." } as const;
  const size = imageSize(bytes);
  if (!size) return { error: "Image illisible." } as const;

  const storageKey = `photo/${input.teamId ?? 0}/${randomUUID()}.${kind}`;
  await putFile(storageKey, bytes);
  const [photo] = await db
    .insert(photos)
    .values({ teamId: input.teamId, caption: input.caption, storageKey, mimeType: MIME[kind], ...size, createdBy: input.createdBy })
    .returning();
  return { photo } as const;
}

const publicPhoto = { id: photos.id, caption: photos.caption, credit: photos.credit, storageKey: photos.storageKey, width: photos.width, height: photos.height };

/** Nombre maximal de photos qui défilent dans le bandeau d'accueil. */
export const MAX_FEATURED = 6;

/** Photos du bandeau d'accueil : les plus récentes mises à la une, qui défilent. */
export async function featuredPhotos() {
  return db
    .select(publicPhoto)
    .from(photos)
    .where(and(eq(photos.featured, true), eq(photos.published, true)))
    .orderBy(desc(photos.createdAt), desc(photos.id))
    .limit(MAX_FEATURED);
}

/** Dernières photos publiées, avec la sélection concernée. */
export async function latestPhotos(limit = 12) {
  return db
    .select({ ...publicPhoto, team: nationalTeams.name, teamSlug: nationalTeams.slug })
    .from(photos)
    .leftJoin(nationalTeams, eq(photos.teamId, nationalTeams.id))
    .where(eq(photos.published, true))
    .orderBy(desc(photos.createdAt), desc(photos.id))
    .limit(limit);
}

/** Photos publiées d'une sélection. */
export async function teamPhotos(teamId: number) {
  return db
    .select(publicPhoto)
    .from(photos)
    .where(and(eq(photos.teamId, teamId), eq(photos.published, true)))
    .orderBy(desc(photos.createdAt), desc(photos.id));
}
