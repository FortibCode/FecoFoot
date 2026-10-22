import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leagues } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Logo d'une ligue, public (portail, fiches). */
export async function GET(_request: Request, ctx: RouteContext<"/media/ligues/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db.select({ key: leagues.logoKey, type: leagues.logoType }).from(leagues).where(eq(leagues.id, id)).limit(1);
  const bytes = row?.key ? await getFileOrNull(row.key) : null;
  if (!row?.type || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": row.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" },
  });
}
