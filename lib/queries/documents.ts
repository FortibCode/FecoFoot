import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/guard";
import { can, canAccessClub } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, documents, players, type Document } from "@/lib/db/schema";
import type { DocumentOwner, DocumentType } from "@/lib/documents";

/** Dernier document de chaque type pour un joueur ou un club. */
export async function latestDocuments(ownerType: DocumentOwner, ownerId: number): Promise<Partial<Record<DocumentType, Document>>> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, ownerType), eq(documents.ownerId, ownerId)))
    .orderBy(desc(documents.createdAt), desc(documents.id));
  const latest: Partial<Record<DocumentType, Document>> = {};
  for (const d of rows) latest[d.type as DocumentType] ??= d;
  return latest;
}

export async function hasDocuments(ownerType: DocumentOwner, ownerId: number, types: DocumentType[]) {
  const rows = await db
    .selectDistinct({ type: documents.type })
    .from(documents)
    .where(and(eq(documents.ownerType, ownerType), eq(documents.ownerId, ownerId), inArray(documents.type, types)));
  const present = new Set(rows.map((r) => r.type));
  return Object.fromEntries(types.map((t) => [t, present.has(t)])) as Record<DocumentType, boolean>;
}

/**
 * Le club concerné par un document (celui du joueur, ou le club lui-même) —
 * c'est lui qui détermine qui peut voir ou modifier la pièce (EF-CLB-04).
 */
export async function ownerClub(ownerType: DocumentOwner, ownerId: number) {
  if (ownerType === "club") {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, ownerId)).limit(1);
    return club ?? null;
  }
  const [row] = await db
    .select({ club: clubs })
    .from(players)
    .innerJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(players.id, ownerId))
    .limit(1);
  return row?.club ?? null;
}

const FEDERAL = new Set(["SUPER_ADMIN", "FEDERATION_ADMIN"]);

/** Consultation : périmètre du club, plus la DTN pour les joueurs (registre en lecture). */
export async function canViewDocument(user: CurrentUser, doc: Pick<Document, "ownerType" | "ownerId">) {
  if (FEDERAL.has(user.role)) return true;
  if (doc.ownerType === "player" && user.role === "DTN") return true;
  const club = await ownerClub(doc.ownerType, doc.ownerId);
  return Boolean(club && canAccessClub(user, club));
}

/** Téléversement / suppression : droit de gestion sur le joueur ou le club, dans son périmètre. */
export async function canManageDocuments(user: CurrentUser, ownerType: DocumentOwner, ownerId: number) {
  const permission = ownerType === "player" ? "players.manage" : "clubs.manage";
  if (!can(user.role, permission)) return false;
  if (FEDERAL.has(user.role)) return true;
  const club = await ownerClub(ownerType, ownerId);
  return Boolean(club && canAccessClub(user, club));
}
