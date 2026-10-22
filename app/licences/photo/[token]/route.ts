import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/guard";
import { can, canAccessClub } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, documents, licenses, players } from "@/lib/db/schema";
import { cardIssued } from "@/lib/licenses";
import { getFileOrNull } from "@/lib/storage";

/**
 * Photo d'identité d'un licencié, par le jeton (non prévisible) de sa licence. Servie :
 *  - au joueur lui-même, et au personnel autorisé dans son périmètre (club, ligue, fédération) ;
 *  - au public (page de vérification du QR code) seulement si le joueur a autorisé la publication
 *    et que la licence a été délivrée.
 * Même réponse « introuvable » dans tous les autres cas.
 */
export async function GET(_request: Request, ctx: RouteContext<"/licences/photo/[token]">) {
  const token = (await ctx.params).token;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Introuvable", { status: 404 });
  const [row] = await db
    .select({ license: licenses, player: players, club: clubs })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .innerJoin(clubs, eq(licenses.clubId, clubs.id))
    .where(eq(licenses.verifyToken, token))
    .limit(1);
  if (!row) return new Response("Introuvable", { status: 404 });

  const user = await getCurrentUser();
  const staff = user && (can(user.role, "licenses.validate") || can(user.role, "licenses.request") || can(user.role, "players.read")) && (canAccessClub(user, row.club) || user.role === "SUPER_ADMIN" || user.role === "FEDERATION_ADMIN");
  const owner = user && row.player.userId === user.id;
  const isPublic = row.player.publishPhoto && cardIssued(row.license.status);
  if (!staff && !owner && !isPublic) return new Response("Introuvable", { status: 404 });

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, "player"), eq(documents.ownerId, row.player.id), eq(documents.type, "PLAYER_PHOTO")))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(1);
  const bytes = doc ? await getFileOrNull(doc.storageKey) : null;
  if (!doc || !bytes) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": doc.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": isPublic ? "public, max-age=600" : "private, max-age=300" },
  });
}
