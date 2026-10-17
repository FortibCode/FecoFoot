import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { canViewDocument } from "@/lib/queries/documents";
import { getFileOrNull } from "@/lib/storage";

/** Consultation d'une pièce : réservée aux personnes ayant accès au joueur ou au club concerné. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });

  const id = Number((await ctx.params).id);
  const [doc] = Number.isInteger(id) ? await db.select().from(documents).where(eq(documents.id, id)).limit(1) : [];
  // Même réponse pour « inexistant » et « interdit » : on ne révèle pas l'existence d'une pièce.
  if (!doc || !(await canViewDocument(user, doc))) return new Response("Introuvable", { status: 404 });

  const bytes = await getFileOrNull(doc.storageKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
