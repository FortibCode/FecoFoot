import "dotenv/config";
import postgres from "postgres";

/**
 * Suppression des données de démonstration (scripts/seed-demo.mts) d'après le journal d'audit (DEMO_SEED) :
 * seules les lignes créées par le chargement sont supprimées ; la saison de Ligue 1 revient en préparation.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
const sql = postgres(url, { max: 1 });

const seeds = await sql`
  select id, entity_id, details from audit_logs s where action = 'DEMO_SEED'
    and not exists (select 1 from audit_logs p where p.action = 'DEMO_PURGE' and p.id > s.id)`;
if (seeds.length === 0) {
  console.log("Aucune donnée de démonstration à supprimer.");
  await sql.end();
  process.exit(0);
}

await sql.begin(async (tx) => {
  for (const s of seeds) {
    const d = s.details as Record<string, number[]>;
    const ids = (k: string) => (d[k]?.length ? d[k] : [-1]);
    await tx`delete from payments where id in ${tx(ids("payments"))}`;
    await tx`delete from tickets where order_id in ${tx(ids("orders"))}`;
    await tx`delete from ticket_orders where id in ${tx(ids("orders"))}`;
    await tx`delete from accreditations where id in ${tx(ids("accreditations"))}`;
    await tx`delete from ticket_events where id in ${tx(ids("events"))}`;
    await tx`delete from match_officials where match_id in ${tx(ids("matches"))} or referee_id in ${tx(ids("referees"))}`;
    await tx`delete from match_events where match_id in ${tx(ids("matches"))}`;
    await tx`delete from match_lineups where match_id in ${tx(ids("matches"))}`;
    await tx`delete from matches where id in ${tx(ids("matches"))}`;
    await tx`update competitions set status = 'DRAFT', relegation_spots = 0 where id = ${Number(s.entity_id)}`;
    await tx`delete from referees where id in ${tx(ids("referees"))}`;
    await tx`delete from supporters where id in ${tx(ids("supporters"))}`;
    await tx`delete from transfers where id in ${tx(ids("transfers"))}`;
    await tx`delete from licenses where id in ${tx(ids("licenses"))}`;
    await tx`delete from players where id in ${tx(ids("players"))}`;
  }
  await tx`insert into audit_logs (user_id, action, entity, details) values (null, 'DEMO_PURGE', 'demo', ${tx.json({ seeds: seeds.map((s) => s.id) })})`;
});
console.log("Données de démonstration supprimées.");
await sql.end();
