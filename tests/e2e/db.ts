import "dotenv/config";
import postgres from "postgres";

/** Accès direct à la base pour les tests : lire les messages enregistrés en mode NOTIFY_MODE=log. */
export async function latestNotification(recipient: string, topic: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<{ body: string; channel: string }[]>`
      select body, channel from notifications where recipient = ${recipient} and topic = ${topic} order by id desc limit 1`;
    return row ?? null;
  } finally {
    await sql.end();
  }
}

export const extractLink = (body: string) => body.match(/https?:\/\/\S+/)?.[0] ?? null;

/** Exécute une requête SQL de préparation (données impossibles à créer par l'interface, ex. saison passée). */
export async function withDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Joueurs licenciés (licence validée de la saison) pour un club de test : prépare les compositions
 * et feuilles de match sans rejouer tout le circuit de licence.
 */
export async function seedLicensedPlayers(clubName: string, count: number, season: number, tag: string) {
  return withDb(async (sql) => {
    const [{ id: clubId }] = await sql<{ id: number }[]>`select id from clubs where name = ${clubName}`;
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const last = `E2E${tag}${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`.toUpperCase();
      const [{ id }] = await sql<{ id: number }[]>`
        insert into players (federal_id, last_name, first_name, birth_date, gender, club_id, identity_key, position)
        values (${`FCF-J-E2E-${tag}-${clubId}-${i}`.toUpperCase()}, ${last}, ${"Joueur"}, ${"1998-01-01"}, 'M', ${clubId}, ${`e2e|${tag}|${clubId}|${i}`},
                ${i === 0 ? "GOALKEEPER" : i < 5 ? "DEFENDER" : i < 9 ? "MIDFIELDER" : "FORWARD"})
        returning id`;
      await sql`insert into licenses (number, player_id, club_id, season, category, type, status, medical_check_date, fee_amount, expires_at, verify_token)
        values (${`LIC-E2E-${tag}-${clubId}-${i}`}, ${id}, ${clubId}, ${season}, 'SENIOR', 'AMATEUR', 'VALIDATED', ${`${season}-08-01`}, 0,
                ${`${season + 1}-06-30T22:59:59Z`}, ${`e2e-tok-${tag}-${clubId}-${i}-xxxxxxxxxxxxxx`})`;
      ids.push(id);
    }
    return { clubId, playerIds: ids };
  });
}
