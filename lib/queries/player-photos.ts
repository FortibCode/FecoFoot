import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cardIssued, type LicenseStatus } from "@/lib/licenses";

/**
 * Adresse de la photo d'identité des joueurs (route /licences/photo/[jeton], par leur dernière licence).
 * `publicOnly` (portail) : seulement si le joueur a autorisé la publication et que sa licence a été délivrée,
 * comme le contrôle de la route ; sinon (administration) la route vérifie elle-même le périmètre de l'utilisateur.
 */
export async function playerPhotoUrls(playerIds: number[], { publicOnly }: { publicOnly: boolean }): Promise<Map<number, string>> {
  const ids = [...new Set(playerIds)].filter(Number.isInteger);
  if (ids.length === 0) return new Map();
  const rows = await db.execute<{ player_id: number; token: string; status: LicenseStatus; publish: boolean; doc_id: number }>(sql`
    select distinct on (l.player_id) l.player_id, l.verify_token as token, l.status, p.publish_photo as publish, d.id as doc_id
    from licenses l
    join players p on p.id = l.player_id
    join lateral (select id from documents where owner_type = 'player' and owner_id = l.player_id and type = 'PLAYER_PHOTO'
                  order by created_at desc, id desc limit 1) d on true
    where l.player_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
    order by l.player_id, l.season desc, l.id desc`);
  const urls = new Map<number, string>();
  for (const r of rows) {
    if (publicOnly && !(r.publish && cardIssued(r.status))) continue;
    urls.set(Number(r.player_id), `/licences/photo/${r.token}?v=${r.doc_id}`);
  }
  return urls;
}
