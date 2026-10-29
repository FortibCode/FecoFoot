import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubGrants, grantExpenses } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/**
 * Pièces d'une subvention : ?doc=convention | signee | depense&e=<id>. Réservées à la fédération
 * et au club bénéficiaire ; même réponse « introuvable » dans tous les autres cas.
 */
export async function GET(request: Request, ctx: RouteContext<"/admin/subventions/[id]/fichier">) {
  const notFound = () => new Response("Introuvable", { status: 404 });
  const user = await getCurrentUser();
  const id = Number((await ctx.params).id);
  if (!user || !Number.isInteger(id)) return notFound();
  const [g] = await db.select().from(clubGrants).where(eq(clubGrants.id, id)).limit(1);
  if (!g) return notFound();
  const allowed = can(user.role, "programs.manage") || (user.role === "CLUB" && user.clubId === g.clubId);
  if (!allowed) return notFound();

  const params = new URL(request.url).searchParams;
  const doc = params.get("doc");
  let key: string | null = null;
  let type = "application/pdf";
  let name = `${g.number}.pdf`;
  if (doc === "convention") {
    key = g.conventionKey;
    name = `convention-${g.number}.pdf`;
  } else if (doc === "signee") {
    key = g.signedConventionKey;
    type = key?.endsWith(".pdf") ? "application/pdf" : key?.endsWith(".png") ? "image/png" : "image/jpeg";
    name = `convention-signee-${g.number}.${key?.split(".").pop() ?? "pdf"}`;
  } else if (doc === "depense") {
    const [e] = await db.select().from(grantExpenses).where(and(eq(grantExpenses.id, Number(params.get("e"))), eq(grantExpenses.grantId, id))).limit(1);
    if (e) {
      key = e.documentKey;
      type = e.documentType;
      name = `justificatif-${g.number}-${e.id}.${key.split(".").pop()}`;
    }
  }
  const bytes = key ? await getFileOrNull(key) : null;
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
