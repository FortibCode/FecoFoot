import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { championshipDocuments } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Document officiel publié d'un championnat national (PDF), public. */
export async function GET(_request: Request, ctx: RouteContext<"/media/championnats/documents/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [doc] = await db
    .select()
    .from(championshipDocuments)
    .where(and(eq(championshipDocuments.id, id), eq(championshipDocuments.published, true)))
    .limit(1);
  const bytes = doc ? await getFileOrNull(doc.storageKey) : null;
  if (!doc || !bytes) return new Response("Introuvable", { status: 404 });
  const name = `${doc.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "document"}.pdf`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
