import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Visuel de couverture d'un article : public une fois l'article publié, visible par la communication avant. */
export async function GET(_request: Request, ctx: RouteContext<"/media/actualites/[id]">) {
  const id = Number((await ctx.params).id);
  const [a] = Number.isInteger(id) ? await db.select().from(articles).where(eq(articles.id, id)).limit(1) : [];
  if (!a?.coverKey || !a.coverType) return new Response("Introuvable", { status: 404 });
  if (a.status !== "PUBLISHED") {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "communication.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(a.coverKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": a.coverType,
      "X-Content-Type-Options": "nosniff",
      // L'adresse inclut la clé de version (?v=) : mise en cache longue sans risque d'image périmée.
      "Cache-Control": a.status === "PUBLISHED" ? "public, max-age=86400" : "private, no-store",
    },
  });
}
