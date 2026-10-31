import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { governanceBodies, governanceMembers } from "@/lib/db/schema";
import { portraitType } from "@/lib/portraits";
import { getFileOrNull } from "@/lib/storage";

/**
 * Portrait d'un membre d'instance : public pour un membre en fonction d'une instance publiée ; sinon visible
 * seulement par les gestionnaires de la gouvernance (aperçu dans l'administration).
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/membres/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ key: governanceMembers.photoKey, status: governanceMembers.status, published: governanceBodies.published })
    .from(governanceMembers)
    .innerJoin(governanceBodies, eq(governanceBodies.id, governanceMembers.bodyId))
    .where(eq(governanceMembers.id, id))
    .limit(1);
  if (!row?.key) return new Response("Introuvable", { status: 404 });
  const visible = row.published && row.status === "ACTIVE";
  if (!visible) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "governance.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(row.key);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": portraitType(row.key),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": visible ? "public, max-age=86400" : "private, no-store",
    },
  });
}
