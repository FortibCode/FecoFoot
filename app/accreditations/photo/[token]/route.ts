import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { accreditationByBadge } from "@/lib/queries/accreditations";
import { getFileOrNull } from "@/lib/storage";

/**
 * Photo d'un badge presse, par le jeton du badge. Publique une fois l'accréditation approuvée (badge,
 * vérification au scan) ; avant, réservée au service communication qui instruit la demande.
 */
export async function GET(_request: Request, ctx: RouteContext<"/accreditations/photo/[token]">) {
  const row = await accreditationByBadge((await ctx.params).token);
  if (!row?.acc.photoKey || !row.acc.photoType) return new Response("Introuvable", { status: 404 });
  const approved = row.acc.status === "APPROVED";
  if (!approved) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "communication.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(row.acc.photoKey);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": row.acc.photoType, "X-Content-Type-Options": "nosniff", "Cache-Control": approved ? "public, max-age=600" : "private, no-store" },
  });
}
