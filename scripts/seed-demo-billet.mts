import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { formatFanId } from "../lib/supporters";
import { formatTicketNumber } from "../lib/ticketing";

/**
 * Supporter FICTIF avec des billets, pour voir l'espace supporter et le billet comme un acheteur :
 *   npm run demo:billet
 * Crée « Démo Billet » (téléphone 06 000 00 01, mot de passe affiché une seule fois) et 2 billets payés
 * pour la prochaine rencontre en vente. Inscrit au journal (DEMO_SEED) : `npm run demo:purge` le supprime.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
if (process.env.NODE_ENV === "production" || process.env.PAYMENT_MODE === "live") throw new Error("Données de démonstration interdites en production.");
const sql = postgres(url, { max: 1 });
const next = async (tx: postgres.TransactionSql, seq: string) => Number((await tx`select nextval(${seq}) as n`)[0].n);

const PHONE = "+242060000001";
const [exists] = await sql`select id from supporters where phone = ${PHONE}`;
if (exists) {
  console.log("Le supporter de démonstration existe déjà (06 000 00 01). npm run demo:purge pour le retirer.");
  await sql.end();
  process.exit(0);
}
const [ev] = await sql`select id, title from ticket_events where kickoff_at > now() and sales_status in ('PRESALE', 'OPEN') order by kickoff_at limit 1`;
if (!ev) throw new Error("Aucune rencontre en vente.");
const [cat] = await sql`select id, name, public_price from ticket_categories where event_id = ${ev.id} order by public_price desc limit 1`;

const password = `Demo-${randomBytes(4).toString("hex")}`;
const created = { supporters: [] as number[], orders: [] as number[], payments: [] as number[] };
let fanId = "";
await sql.begin(async (tx) => {
  fanId = formatFanId(await next(tx, "fan_id_seq"));
  const [s] = await tx`
    insert into supporters (fan_id, last_name, first_name, birth_date, phone, email, password_hash, id_document_type, id_document_number, id_verified_at, consent_at)
    values (${fanId}, 'BILLET', 'Démo', '1995-06-15', ${PHONE}, 'demo.billet@demo.fecofoot.cg', ${await bcrypt.hash(password, 10)}, 'CNI', 'DEMO-BILLET', now(), now())
    returning id`;
  created.supporters.push(s.id);
  const total = 2 * cat.public_price;
  const [o] = await tx`
    insert into ticket_orders (reference, event_id, supporter_id, channel, status, total, paid_at)
    values (${`CMD-${randomBytes(4).toString("hex").toUpperCase()}`}, ${ev.id}, ${s.id}, 'ONLINE', 'PAID', ${total}, now())
    returning id, reference`;
  created.orders.push(o.id);
  for (const holder of ["Démo BILLET", "Grâce BILLET"]) {
    await tx`
      insert into tickets (number, order_id, event_id, category_id, holder_name, holder_supporter_id, price, token, status)
      values (${formatTicketNumber(await next(tx, "ticket_number_seq"))}, ${o.id}, ${ev.id}, ${cat.id}, ${holder}, ${holder === "Démo BILLET" ? s.id : null},
        ${cat.public_price}, ${randomBytes(24).toString("base64url")}, 'VALID')`;
  }
  const [p] = await tx`
    insert into payments (reference, purpose, target_id, method, phone, supporter_id, amount, status, provider_ref, confirmed_at)
    values (${`PAY-TKT-${randomBytes(4).toString("hex").toUpperCase()}`}, 'TICKET_ORDER', ${o.id}, 'MTN_MOMO', ${PHONE}, ${s.id}, ${total}, 'SUCCEEDED', 'SIM-DEMO', now())
    returning id`;
  created.payments.push(p.id);
  await tx`insert into audit_logs (user_id, action, entity, details) values (null, 'DEMO_SEED', 'demo-billet', ${tx.json(created)})`;
});
console.log(`Supporter de démonstration ${fanId} : 2 billets « ${cat.name} » pour ${ev.title}.`);
console.log(`Connexion : /supporters/connexion — téléphone 06 000 00 01 — mot de passe ${password}`);
await sql.end();
