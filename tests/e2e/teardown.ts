import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

/**
 * Supprime les données créées par les tests de bout en bout :
 * clubs « E2E … » (et leurs joueurs, licences, accords, dirigeants, pièces) et comptes @e2e.example.cg.
 * Les lignes du journal d'audit sont conservées, détachées des comptes supprimés.
 */
export default async function teardown() {
  const url = process.env.DATABASE_URL;
  // E2E_KEEP=1 : conserve les données pour inspecter un échec.
  if (!url || process.env.E2E_KEEP) return;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const keys: string[] = [];
  try {
    await sql.begin(async (tx) => {
      // Lot 2 : compétitions (matchs, événements, compositions, désignations en cascade), arbitres, sélections.
      await tx`delete from competitions where name like 'E2E %'`;
      const e2eReferees = tx`select id from referees where last_name like 'E2E%'`;
      await tx`delete from match_officials where referee_id in (${e2eReferees})`;
      // Les comptes des arbitres de test (@e2e.example.cg) sont supprimés avec les autres comptes de test.
      await tx`delete from referees where last_name like 'E2E%'`;
      await tx`delete from selections where title like 'E2E %'`;
      await tx`delete from national_staff where full_name like 'E2E %'`;
      await tx`delete from national_fixtures where opponent like 'E2E %'`;

      const clubs = tx`select id from clubs where name like 'E2E %'`;
      const players = tx`select id from players where club_id in (${clubs})`;
      const docs = await tx<{ storage_key: string }[]>`
        delete from documents
        where (owner_type = 'club' and owner_id in (${clubs})) or (owner_type = 'player' and owner_id in (${players}))
        returning storage_key`;
      keys.push(...docs.map((d) => d.storage_key));
      await tx`delete from transfers where from_club_id in (${clubs}) or to_club_id in (${clubs}) or player_id in (${players})`;
      await tx`delete from player_consents where club_id in (${clubs}) or player_id in (${players})`;
      await tx`delete from licenses where club_id in (${clubs}) or player_id in (${players})`;
      await tx`delete from selection_players where player_id in (${players})`;
      await tx`delete from players where id in (${players})`;
      await tx`delete from club_officials where club_id in (${clubs})`;
      const users = tx`select id from users where email like '%@e2e.example.cg'`;
      await tx`update audit_logs set user_id = null where user_id in (${users})`;
      await tx`update players set created_by = null where created_by in (${users})`;
      await tx`delete from users where id in (${users})`;
      await tx`delete from notifications where recipient like '%@e2e.example.cg' or body like '%E2E %' or body like '%e2e%'`;
      // Compteurs de limitation : ceux des comptes de test et ceux de la machine locale qui exécute les tests.
      await tx`delete from rate_limits where key like '%e2e.example.cg' or key like '%:::1' or key like '%:127.0.0.1'`;
      await tx`delete from transfer_windows where name like 'E2E %'`;
      await tx`delete from clubs where id in (${clubs})`;
    });
    const root = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
    await Promise.all(keys.map((k) => rm(path.join(root, k), { force: true })));
  } finally {
    await sql.end();
  }
}
