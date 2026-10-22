import "dotenv/config";
import postgres from "postgres";
import { formatFederalId, identityKey, seasonOf } from "../lib/licenses";
import { formatTransferNumber } from "../lib/transfers";

/**
 * Transferts homologués de DÉMONSTRATION (jamais en production), pour l'affichage de la page publique /transferts :
 *   npm run demo:transferts
 * Joueurs FICTIFS (aucun joueur réel ne se voit attribuer un transfert inventé) ; clubs réels.
 * Inscrit au journal (DEMO_SEED) :
 * `npm run demo:purge` supprime joueurs et transferts.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
if (process.env.NODE_ENV === "production" || process.env.PAYMENT_MODE === "live") throw new Error("Données de démonstration interdites en production.");
const sql = postgres(url, { max: 1 });
const next = async (tx: postgres.TransactionSql, seq: string) => Number((await tx`select nextval(${seq}) as n`)[0].n);

const [done] = await sql`select 1 from audit_logs s where action = 'DEMO_SEED' and entity = 'demo-transferts'
  and not exists (select 1 from audit_logs p where p.action = 'DEMO_PURGE' and p.id > s.id) limit 1`;
if (done) {
  console.log("Transferts de démonstration déjà chargés (npm run demo:purge pour les retirer).");
  await sql.end();
  process.exit(0);
}

const season = seasonOf();
type Move = { last: string; first: string; birth: string; position: string; from: string | null; to: string; type: "DEFINITIVE" | "LOAN" | "FREE"; fee: number; decided: string };
const MOVES: Move[] = [
  { last: "MAKOSSO", first: "Grâce", birth: "2001-03-14", position: "FORWARD", from: "Patronage Sainte-Anne", to: "CARA Brazzaville", type: "DEFINITIVE", fee: 1_500_000, decided: "2026-08-21" },
  { last: "NGOMA", first: "Prince", birth: "2003-07-02", position: "MIDFIELDER", from: "Étoile du Congo", to: "V. Club Mokanda", type: "LOAN", fee: 0, decided: "2026-08-28" },
  { last: "MOUKALA", first: "Chancel", birth: "1999-11-23", position: "DEFENDER", from: null, to: "AS Otohô", type: "FREE", fee: 0, decided: "2026-09-04" },
  { last: "BOUESSO", first: "Exaucé", birth: "2002-01-30", position: "GOALKEEPER", from: "FC Kondzo", to: "CSMD Diables Noirs", type: "DEFINITIVE", fee: 800_000, decided: "2026-09-12" },
  { last: "LOEMBA", first: "Dieuveil", birth: "2004-05-18", position: "MIDFIELDER", from: "JS Poto-Poto", to: "Inter Club", type: "LOAN", fee: 0, decided: "2026-09-26" },
  { last: "TSIBA", first: "Rodrigue", birth: "2000-09-09", position: "FORWARD", from: "Nico-Nicoyé", to: "AS Cheminots", type: "DEFINITIVE", fee: 600_000, decided: "2026-10-08" },
];

const created = { players: [] as number[], transfers: [] as number[] };
await sql.begin(async (tx) => {
  const [admin] = await tx`select id from users where role = 'SUPER_ADMIN' order by id limit 1`;
  const clubId = async (name: string) => {
    const [c] = await tx`select id from clubs where name = ${name}`;
    if (!c) throw new Error(`Club introuvable : ${name}`);
    return c.id as number;
  };
  for (const m of MOVES) {
    const from = m.from ? await clubId(m.from) : null;
    const to = await clubId(m.to);
    // Le joueur est dans son nouveau club : transfert homologué.
    const [p] = await tx`
      insert into players (federal_id, last_name, first_name, birth_date, gender, nationality, position, club_id, identity_key, created_by)
      values (${formatFederalId(new Date().getFullYear(), await next(tx, "player_federal_seq"))}, ${m.last}, ${m.first}, ${m.birth}, 'M', 'Congolaise', ${m.position}, ${to},
        ${identityKey(m.last, m.first, m.birth)}, ${admin.id})
      returning id`;
    created.players.push(p.id);
    const decided = new Date(`${m.decided}T11:00:00+01:00`);
    const [t] = await tx`
      insert into transfers (number, player_id, from_club_id, to_club_id, type, fee, loan_end_date, season, status,
        release_granted, release_at, decided_by, decided_at, created_by, created_at)
      values (${formatTransferNumber(season, await next(tx, "transfer_number_seq"))}, ${p.id}, ${from}, ${to}, ${m.type}, ${m.fee},
        ${m.type === "LOAN" ? `${season + 1}-06-30` : null}, ${season}, 'APPROVED',
        ${from ? true : null}, ${from ? new Date(decided.getTime() - 4 * 86_400_000) : null}, ${admin.id}, ${decided}, ${admin.id}, ${new Date(decided.getTime() - 10 * 86_400_000)})
      returning id`;
    created.transfers.push(t.id);
  }
  await tx`insert into audit_logs (user_id, action, entity, details) values (null, 'DEMO_SEED', 'demo-transferts', ${tx.json(created)})`;
});
console.log(`${created.transfers.length} transferts homologués de démonstration (joueurs fictifs).`);
await sql.end();
