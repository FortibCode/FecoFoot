import "dotenv/config";
import { rm, rmdir } from "node:fs/promises";
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
      // Discipline : dossiers liés aux données de test.
      await tx`delete from discipline_cases where competition_id in (select id from competitions where name like 'E2E %')
        or club_id in (select id from clubs where name like 'E2E %')
        or player_id in (select id from players where club_id in (select id from clubs where name like 'E2E %'))`;
      // Lot 2 : compétitions (matchs, événements, compositions, désignations en cascade), arbitres, sélections.
      await tx`delete from competitions where name like 'E2E %'`;
      // Stades de test (leurs matchs viennent d'être supprimés avec les compétitions).
      await tx`delete from stadiums where name like 'E2E %'`;
      const e2eReferees = tx`select id from referees where last_name like 'E2E%'`;
      await tx`delete from match_officials where referee_id in (${e2eReferees})`;
      // Les comptes des arbitres de test (@e2e.example.cg) sont supprimés avec les autres comptes de test.
      await tx`delete from referees where last_name like 'E2E%'`;
      await tx`delete from selections where title like 'E2E %'`;
      await tx`delete from national_staff where full_name like 'E2E %'`;
      await tx`delete from national_fixtures where opponent like 'E2E %'`;
      // Compétitions internationales de test (groupes, pays et matchs en cascade).
      await tx`delete from intl_competitions where name like 'E2E %'`;

      // Instances de test (membres en cascade).
      await tx`delete from governance_bodies where name like 'E2E %'`;

      // Actualités de test (et leurs visuels).
      const covers = await tx<{ cover_key: string | null }[]>`delete from articles where title like 'E2E %' returning cover_key`;
      keys.push(...covers.map((c) => c.cover_key).filter((k): k is string => k !== null));

      // Trésorerie : paiements de test.
      await tx`delete from payments where reference like 'PAY-%-E2E%'`;

      // Photothèque : photos de test (et leurs fichiers).
      const pics = await tx<{ storage_key: string }[]>`delete from photos where caption like 'E2E %' returning storage_key`;
      keys.push(...pics.map((p) => p.storage_key));

      // Lot 3 : billetterie de test (billets, commandes, paiements), puis supporters de test.
      const events = tx`select id from ticket_events where title like 'E2E %'`;
      const orders = tx`select id from ticket_orders where event_id in (${events})`;
      await tx`delete from payments where purpose = 'TICKET_ORDER' and target_id in (${orders})`;
      await tx`delete from notifications where recipient in (select phone from accreditations where event_id in (${events}))`;
      await tx`delete from accreditations where event_id in (${events})`;
      await tx`delete from tickets where event_id in (${events})`;
      await tx`delete from ticket_orders where event_id in (${events})`;
      await tx`delete from ticket_events where id in (${events})`;
      // Lot 3 : supporters de test (paiements, adhésions, points).
      const fans = tx`select id from supporters where last_name like 'E2E%'`;
      await tx`delete from payments where supporter_id in (${fans})`;
      await tx`delete from supporter_points where supporter_id in (${fans})`;
      await tx`delete from memberships where supporter_id in (${fans})`;
      await tx`update supporters set banned_by = null where id in (${fans})`;
      const fanPhotos = await tx<{ photo_key: string | null }[]>`delete from supporters where last_name like 'E2E%' returning photo_key`;
      keys.push(...fanPhotos.map((f) => f.photo_key).filter((k): k is string => k !== null));

      const clubs = tx`select id from clubs where name like 'E2E %'`;
      const players = tx`select id from players where club_id in (${clubs})`;
      // Formations et subventions de test (justificatifs en cascade) et leurs pièces.
      const grantFiles = await tx<{ k: string | null }[]>`
        select unnest(array[convention_key, signed_convention_key]) as k from club_grants where club_id in (${clubs})
        union all select document_key from grant_expenses where grant_id in (select id from club_grants where club_id in (${clubs}))`;
      keys.push(...grantFiles.map((f) => f.k).filter((k): k is string => k !== null));
      await tx`delete from club_grants where club_id in (${clubs})`;
      await tx`delete from training_registrations where club_id in (${clubs}) or training_id in (select id from trainings where title like 'E2E %')`;
      await tx`delete from trainings where title like 'E2E %'`;
      const docs = await tx<{ storage_key: string }[]>`
        delete from documents
        where (owner_type = 'club' and owner_id in (${clubs})) or (owner_type = 'player' and owner_id in (${players}))
        returning storage_key`;
      keys.push(...docs.map((d) => d.storage_key));
      await tx`delete from payments where purpose = 'LICENSE_FEE' and target_id in (select id from licenses where club_id in (${clubs}))`;
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
    // Dossiers devenus vides (un par joueur, club, article…) : supprimés ; rmdir échoue sans dommage s'il reste un fichier.
    await Promise.all([...new Set(keys.map((k) => path.dirname(path.join(root, k))))].map((d) => rmdir(d).catch(() => {})));
  } finally {
    await sql.end();
  }
}
