import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, documents } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Logo d'un club affilié, public (portail, classements, calendriers). */
export async function GET(_request: Request, ctx: RouteContext<"/media/clubs/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ storageKey: documents.storageKey, contentType: documents.contentType })
    .from(documents)
    .innerJoin(clubs, eq(clubs.id, documents.ownerId))
    .where(and(eq(documents.ownerType, "club"), eq(documents.type, "CLUB_LOGO"), eq(documents.ownerId, id), eq(clubs.status, "AFFILIATED")))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(1);
  const bytes = row ? await getFileOrNull(row.storageKey) : null;
  if (!row || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": row.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" },
  });
}
