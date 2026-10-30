import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { selectionPlayers, selections } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Portrait d'un joueur convoqué hors registre, public une fois la liste publiée. */
export async function GET(_request: Request, ctx: RouteContext<"/media/convoques/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ key: selectionPlayers.photoKey })
    .from(selectionPlayers)
    .innerJoin(selections, eq(selections.id, selectionPlayers.selectionId))
    .where(and(eq(selectionPlayers.id, id), eq(selections.status, "PUBLISHED")))
    .limit(1);
  const bytes = row?.key ? await getFileOrNull(row.key) : null;
  if (!row?.key || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TYPES[row.key.split(".").pop() ?? ""] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" },
  });
}
