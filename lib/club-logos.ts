import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

/**
 * Logos des clubs : la pièce « Logo du club » la plus récente, téléversée dans la fiche du club
 * (Administration › Clubs). Un nouveau logo remplace l'ancien partout sur le portail.
 */
export async function clubLogos(clubIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(clubIds)].filter((id) => Number.isInteger(id));
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: documents.id, clubId: documents.ownerId })
    .from(documents)
    .where(and(eq(documents.ownerType, "club"), eq(documents.type, "CLUB_LOGO"), inArray(documents.ownerId, ids)))
    .orderBy(desc(documents.createdAt), desc(documents.id));
  const map = new Map<number, string>();
  // La version (?v=) change avec le fichier : mise en cache longue sans logo périmé.
  for (const r of rows) if (!map.has(r.clubId)) map.set(r.clubId, `/media/clubs/${r.clubId}?v=${r.id}`);
  return map;
}
