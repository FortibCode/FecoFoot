import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { accreditations } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

/** Justificatif d'une demande d'accréditation (scan de carte, ordre de mission) : service communication seulement. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/accreditations/[id]/justificatif">) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "communication.manage")) return new Response("Introuvable", { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db.select({ key: accreditations.proofKey, type: accreditations.proofType, number: accreditations.number }).from(accreditations).where(eq(accreditations.id, id)).limit(1);
  const bytes = row?.key ? await getFileOrNull(row.key) : null;
  if (!row?.key || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="justificatif-${row.number}.${row.key.split(".").pop()}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
