import "dotenv/config";
import postgres from "postgres";

/**
 * Divisions nationales (une seule exécution suffit ; relançable sans effet de bord) :
 *  1. le championnat national « Ligue 1 » prend son nom officiel « Ligue 1 National » ;
 *  2. « Ligue 2 National » est créée (même saison, en préparation, sans club : les engagements restent à faire) ;
 *  3. les clubs engagés en Ligue 1 National sont rattachés directement à la fédération (division nationale)
 *     et quittent les ligues départementales où l'import initial les avait placés d'après leur ville.
 * Chaque changement est inscrit au journal d'audit.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
const sql = postgres(url, { max: 1 });

await sql.begin(async (tx) => {
  const audit = (action: string, entity: string, entityId: number | null, details: object) =>
    tx`insert into audit_logs (user_id, action, entity, entity_id, details) values (null, ${action}, ${entity}, ${entityId === null ? null : String(entityId)}, ${tx.json(details as never)})`;

  const renamed = await tx`update competitions set name = 'Ligue 1 National' where name = 'Ligue 1' and league_id is null returning id`;
  for (const r of renamed) await audit("UPDATE", "competition", r.id, { name: "Ligue 1 National", script: "divisions-nationales" });

  const [l1] = await tx`select id, season, category, gender, points_win, points_draw, points_loss, double_round from competitions where name = 'Ligue 1 National' and league_id is null order by season desc limit 1`;
  if (!l1) throw new Error("Championnat « Ligue 1 National » introuvable.");

  const slug = `ligue-2-national-${l1.season}-${l1.season + 1}`;
  const created = await tx`
    insert into competitions (name, slug, season, category, gender, type, status, double_round, points_win, points_draw, points_loss)
    select 'Ligue 2 National', ${slug}, ${l1.season}, ${l1.category}, ${l1.gender}, 'LEAGUE', 'DRAFT', ${l1.double_round}, ${l1.points_win}, ${l1.points_draw}, ${l1.points_loss}
    where not exists (select 1 from competitions where name = 'Ligue 2 National' and season = ${l1.season} and league_id is null)
    returning id`;
  for (const r of created) await audit("CREATE", "competition", r.id, { name: "Ligue 2 National", season: l1.season, script: "divisions-nationales" });

  const moved = await tx`
    update clubs c set league_id = null, updated_at = now()
    from leagues l
    where c.league_id = l.id
      and c.id in (select club_id from competition_teams where competition_id = ${l1.id})
    returning c.id, c.name, l.code`;
  for (const c of moved) await audit("UPDATE", "club", c.id, { leagueId: { from: c.code, to: "Fédération (division nationale)" }, script: "divisions-nationales" });

  console.log(`Ligue 1 National : ${renamed.length ? "renommée" : "déjà à jour"}. Ligue 2 National : ${created.length ? "créée" : "déjà présente"}.`);
  console.log(`Clubs rattachés à la fédération : ${moved.length ? moved.map((c) => c.name).join(", ") : "aucun (déjà fait)"}.`);
});
await sql.end();
