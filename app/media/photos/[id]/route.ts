import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Photo de la photothèque : publique une fois publiée, visible par la communication avant. */
export async function GET(_request: Request, ctx: RouteContext<"/media/photos/[id]">) {
  const id = Number((await ctx.params).id);
  const [p] = Number.isInteger(id) ? await db.select().from(photos).where(eq(photos.id, id)).limit(1) : [];
  if (!p) return new Response("Introuvable", { status: 404 });
  if (!p.published) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "communication.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(p.storageKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": p.mimeType,
      "X-Content-Type-Options": "nosniff",
      // L'adresse inclut la clé de version (?v=) : mise en cache longue sans risque d'image périmée.
      "Cache-Control": p.published ? "public, max-age=86400" : "private, no-store",
    },
  });
}
