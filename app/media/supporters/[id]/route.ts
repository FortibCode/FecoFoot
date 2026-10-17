import { eq } from "drizzle-orm";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { supporters } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Photo d'identité d'un supporter : visible par lui-même et par la billetterie seulement (données personnelles). */
export async function GET(_request: Request, ctx: RouteContext<"/media/supporters/[id]">) {
  const id = Number((await ctx.params).id);
  const [s] = Number.isInteger(id) ? await db.select().from(supporters).where(eq(supporters.id, id)).limit(1) : [];
  if (!s?.photoKey || !s.photoType) return new Response("Introuvable", { status: 404 });
  const fan = await getCurrentSupporter();
  if (fan?.id !== s.id) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "ticketing.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(s.photoKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": s.photoType, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" },
  });
}
