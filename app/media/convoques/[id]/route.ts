import { eq } from "drizzle-orm";
import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { selectionPlayers, selections } from "@/lib/db/schema";
import { getFileOrNull } from "@/lib/storage";

const TYPES: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Portrait d'un joueur convoqué hors registre : public une fois la liste publiée ; avant, visible seulement
 * par les gestionnaires des sélections (aperçu dans l'administration).
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/convoques/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ key: selectionPlayers.photoKey, status: selections.status })
    .from(selectionPlayers)
    .innerJoin(selections, eq(selections.id, selectionPlayers.selectionId))
    .where(eq(selectionPlayers.id, id))
    .limit(1);
  if (!row?.key) return new Response("Introuvable", { status: 404 });
  const published = row.status === "PUBLISHED";
  if (!published) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "national_teams.manage")) return new Response("Introuvable", { status: 404 });
  }
  const bytes = await getFileOrNull(row.key);
  if (!bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[row.key.split(".").pop() ?? ""] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      // Aperçu d'une liste non publiée : jamais mis en cache partagé.
      "Cache-Control": published ? "public, max-age=86400" : "private, no-store",
    },
  });
}
