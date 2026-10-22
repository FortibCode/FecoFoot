import "dotenv/config";
import postgres from "postgres";
import { formatAffiliationNumber } from "../lib/clubs";

/**
 * Divisions nationales, saison 2025-2026 (relançable) : npm run saison:2025-2026
 *
 * État vérifié le 22 octobre 2026 :
 *  - la saison 2024-2025 a été annulée (mai 2025) ; le tournoi organisé par le ministère de janvier à mars 2025
 *    n'a été reconnu ni par la Fécofoot, ni par la CAF, ni par la FIFA → ses données importées (API-Football,
 *    « Ligue 1 National 2024-2025 ») sont retirées, ainsi que l'équipe « Racine » (club haïtien rattaché par erreur
 *    chez le fournisseur) ;
 *  - Ligue 1 2025-2026 : 16 clubs, d'après les rencontres publiées des 14, 20 et 21 décembre 2025 (betstudy.com,
 *    footlive.fr) ; saison interrompue après un seul match, reprise annoncée le 21 novembre 2026 par la Fécofoot ;
 *    calendrier non publié → aucun match n'est programmé (les matchs de démonstration sont retirés) ; saison publiée, affichée « À venir » sur le portail ;
 *  - Ligue 2 2025-2026 : liste des clubs non publiée → aucun club engagé.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
const sql = postgres(url, { max: 1 });

const SEASON = 2025;
// Clubs engagés en Ligue 1 2025-2026 (nom sur la plateforme ; créés s'ils n'existent pas, rattachés à la fédération).
const LIGUE_1 = [
  "AC Léopards de Dolisie",
  "AS Cheminots",
  "AS Otohô",
  "AS Red Stars",
  "AS Vegas",
  "CARA Brazzaville",
  "CSMD Diables Noirs",
  "Étoile du Congo",
  "FC Kondzo",
  "Inter Club Pointe Noire",
  "Jeunesse Sportive de Talangaï",
  "Jeunesse Unie de Kintélé",
  "Kouilou Football Académie",
  "Nouvelle Génération",
  "Racing Club de Brazzaville",
  "V. Club Mokanda",
];
const NEW_CLUBS: Record<string, { city: string; slug: string }> = {
  "AS Vegas": { city: "Brazzaville", slug: "as-vegas" },
  "Racing Club de Brazzaville": { city: "Brazzaville", slug: "racing-club-de-brazzaville" },
};
const SOURCES = "Sources : calendriers publiés des 14, 20 et 21 décembre 2025 (betstudy.com, footlive.fr) ; Les Dépêches de Brazzaville ; Sport News Africa (17 octobre 2026).";
const DESCRIPTIONS: Record<string, string> = {
  "ligue-1": `Championnat national de première division : 16 clubs pour la saison 2025-2026.

Lancée en décembre 2025 puis interrompue après une seule rencontre, la saison 2025-2026 reprend le 21 novembre 2026, selon l'annonce faite par le président de la Fécofoot, Éric Alain Mantot, aux dirigeants de clubs réunis à Pointe-Noire en octobre 2026. Le calendrier officiel n'est pas encore publié.

La saison 2024-2025 a été annulée en mai 2025 ; le tournoi organisé de janvier à mars 2025 par le ministère des Sports n'a pas été reconnu par la Fécofoot, la CAF et la FIFA. Dernier champion : AC Léopards de Dolisie (2023-2024).

Liste des clubs établie d'après les calendriers publiés en décembre 2025, à confirmer par la fédération. ${SOURCES}`,
  "ligue-2": `Championnat national de deuxième division, disputé en deux zones : zone A (Brazzaville et Pool) et zone B (Pointe-Noire et Kouilou).

Saison 2025-2026 : la liste des clubs engagés et le calendrier ne sont pas encore publiés par la fédération.`,
};

await sql.begin(async (tx) => {
  const audit = (action: string, entity: string, entityId: number | null, details: object) =>
    tx`insert into audit_logs (user_id, action, entity, entity_id, details) values (null, ${action}, ${entity}, ${entityId === null ? null : String(entityId)}, ${tx.json({ ...details, script: "saison-2025-2026" } as never)})`;
  const dropMatches = async (competitionId: number) => {
    const ids = (await tx`select id from matches where competition_id = ${competitionId}`).map((m) => m.id as number);
    if (!ids.length) return 0;
    await tx`delete from external_conflicts where match_id in ${tx(ids)}`;
    await tx`delete from external_links where entity = 'match' and entity_id in ${tx(ids)}`;
    await tx`delete from match_officials where match_id in ${tx(ids)}`;
    await tx`delete from match_events where match_id in ${tx(ids)}`;
    await tx`delete from match_lineups where match_id in ${tx(ids)}`;
    await tx`delete from matches where id in ${tx(ids)}`;
    return ids.length;
  };

  // 1. Tournoi non reconnu de 2024-2025 (import API-Football) : retiré.
  const [ch1] = await tx`select id from championships where code = 'ligue-1'`;
  const [ch2] = await tx`select id from championships where code = 'ligue-2'`;
  for (const c of await tx`select id from competitions where championship_id = ${ch1.id} and season = 2024`) {
    const n = await dropMatches(c.id);
    await tx`delete from competition_teams where competition_id = ${c.id}`;
    await tx`delete from external_links where entity = 'competition' and entity_id = ${c.id}`;
    await tx`delete from external_sync_runs where competition_id = ${c.id}`;
    await tx`delete from competitions where id = ${c.id}`;
    await audit("DELETE", "competition", c.id, { reason: "Saison 2024-2025 annulée ; tournoi non reconnu par la Fécofoot, la CAF et la FIFA", matches: n });
  }
  const [racine] = await tx`select id from clubs where name = 'Racine' and city = 'À préciser'`;
  if (racine) {
    await tx`delete from external_links where entity = 'club' and entity_id = ${racine.id}`;
    await tx`delete from documents where owner_type = 'club' and owner_id = ${racine.id}`;
    await tx`delete from clubs where id = ${racine.id}`;
    await audit("DELETE", "club", racine.id, { reason: "Équipe haïtienne rattachée par erreur au championnat congolais chez le fournisseur" });
  }

  // 2. Ligue 1 National 2025-2026 : 16 clubs, aucun match (calendrier non publié).
  const [l1] = await tx`select id from competitions where championship_id = ${ch1.id} order by season desc limit 1`;
  const removed = await dropMatches(l1.id);
  await tx`update competitions set season = ${SEASON}, name = 'Ligue 1 National', slug = 'ligue-1-national-2025-2026', status = 'ONGOING', promotion_spots = 0, relegation_spots = 0 where id = ${l1.id}`;
  const clubIds: number[] = [];
  for (const name of LIGUE_1) {
    let [club] = await tx`select id from clubs where name = ${name}`;
    if (!club) {
      const info = NEW_CLUBS[name];
      if (!info) throw new Error(`Club introuvable : ${name}`);
      const n = Number((await tx`select nextval('club_affiliation_seq') as n`)[0].n);
      [club] = await tx`
        insert into clubs (name, city, league_id, status, slug, affiliation_number)
        values (${name}, ${info.city}, null, 'AFFILIATED', ${info.slug}, ${formatAffiliationNumber(n)}) returning id`;
      await audit("CREATE", "club", club.id, { name, division: "Ligue 1 2025-2026" });
    }
    clubIds.push(club.id);
  }
  await tx`delete from competition_teams where competition_id = ${l1.id} and club_id not in ${tx(clubIds)}`;
  for (const id of clubIds) await tx`insert into competition_teams (competition_id, club_id) values (${l1.id}, ${id}) on conflict do nothing`;
  await tx`update competition_teams set pool = null where competition_id = ${l1.id}`;
  await audit("UPDATE", "competition", l1.id, { season: SEASON, clubs: clubIds.length, demoMatchesRemoved: removed });

  // 3. Ligue 2 National 2025-2026 : publiée, clubs non encore communiqués.
  const [l2] = await tx`select id from competitions where championship_id = ${ch2.id} order by season desc limit 1`;
  if (l2) {
    await dropMatches(l2.id);
    await tx`update competitions set season = ${SEASON}, name = 'Ligue 2 National', slug = 'ligue-2-national-2025-2026', status = 'ONGOING' where id = ${l2.id}`;
    await audit("UPDATE", "competition", l2.id, { season: SEASON });
  }

  for (const [code, description] of Object.entries(DESCRIPTIONS)) {
    await tx`update championships set description = ${description}, updated_at = now() where code = ${code}`;
  }
  console.log(`Ligue 1 National 2025-2026 : ${clubIds.length} clubs, ${removed} match(s) de démonstration retiré(s). Ligue 2 : en préparation.`);
});
await sql.end();
