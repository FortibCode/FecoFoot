import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { championships } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Logo d'un championnat national, public (portail, fiches). */
export async function GET(_request: Request, ctx: RouteContext<"/media/championnats/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db.select({ key: championships.logoKey, type: championships.logoType }).from(championships).where(eq(championships.id, id)).limit(1);
  const bytes = row?.key ? await getFileOrNull(row.key) : null;
  if (!row?.type || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": row.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" },
  });
}
