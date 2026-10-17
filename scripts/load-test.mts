/**
 * Tests de charge de la billetterie (ENF-02, ENF-03, ENF-04) — à lancer avant chaque mise en service majeure :
 *   npm run test:load
 *
 * Mesure la couche métier + PostgreSQL (là où se jouent la survente et le double passage) :
 *  1. ENF-03 : ouverture de la vente d'un grand match — N commandes simultanées sur une tribune
 *     de capacité C < N : débit (commandes / minute) et absence de survente ;
 *  2. ENF-02 : contrôle d'accès — tous les billets lus en parallèle à plusieurs portes, avec doublons :
 *     temps de réponse par billet (objectif < 1 s) et débit (objectif : 30 000 entrées en moins de 2 h).
 * Le serveur web et le réseau s'ajoutent en production : à compléter par un test HTTP sur l'environnement de recette.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { supporters, ticketCategories, ticketEvents } from "../lib/db/schema";
import { createOrder, markOrderPaid, scanTicket } from "../lib/ticket-sales";

const BUYERS = Number(process.env.LOAD_BUYERS ?? 400);
const CAPACITY = Number(process.env.LOAD_CAPACITY ?? 300);
const GATES = Number(process.env.LOAD_GATES ?? 12);
const RUN_ID = Date.now().toString(36).slice(-5);
const TAG = `LOADTEST-${RUN_ID}`;

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((p / 100) * values.length))];
const ms = (n: number) => `${n.toFixed(0)} ms`;

async function cleanup() {
  await db.execute(sql`delete from scan_refusals where event_id in (select id from ticket_events where title = ${TAG})`);
  await db.execute(sql`delete from tickets where event_id in (select id from ticket_events where title = ${TAG})`);
  await db.execute(sql`delete from ticket_orders where event_id in (select id from ticket_events where title = ${TAG})`);
  await db.execute(sql`delete from ticket_events where title = ${TAG}`);
  await db.execute(sql`delete from supporter_points where supporter_id in (select id from supporters where last_name = ${TAG})`);
  await db.execute(sql`delete from supporters where last_name = ${TAG}`);
}

async function main() {
  console.log(`Préparation : ${BUYERS} supporters, tribune de ${CAPACITY} places…`);
  const [event] = await db
    .insert(ticketEvents)
    .values({ slug: TAG.toLowerCase(), title: TAG, kind: "NATIONAL_TEAM", venue: "Test", kickoffAt: new Date(Date.now() + 86_400_000), salesStatus: "OPEN", maxTicketsPerFan: 4 })
    .returning();
  const [category] = await db
    .insert(ticketCategories)
    .values({ eventId: event.id, name: "Tribune test", gate: "Porte T", capacity: CAPACITY, publicPrice: 2000, memberPrice: 2000 })
    .returning();
  const fans = await db
    .insert(supporters)
    .values(
      Array.from({ length: BUYERS }, (_, i) => ({
        fanId: `LT${RUN_ID}-${i}`,
        lastName: TAG,
        firstName: `F${i}`,
        birthDate: new Date("1990-01-01"),
        // Préfixe 04 (sans Mobile Money) : aucun risque de collision avec un vrai supporter de test.
        phone: `+24204${String(i).padStart(7, "0")}`,
        passwordHash: "x",
        idDocumentType: "CNI" as const,
        idDocumentNumber: `${TAG}-${i}`,
        consentAt: new Date(),
      })),
    )
    .returning({ id: supporters.id });

  // ── ENF-03 : ouverture de la vente, toutes les commandes en même temps
  const t0 = performance.now();
  const results = await Promise.all(
    fans.map(async (f) => {
      const start = performance.now();
      const r = await createOrder({ eventId: event.id, categoryId: category.id, supporterId: f.id, extraHolders: [], channel: "ONLINE", soldBy: null });
      return { r, latency: performance.now() - start };
    }),
  );
  const elapsed = (performance.now() - t0) / 1000;
  const ok = results.filter((x) => !("error" in x.r));
  const [{ sold }] = await db.execute<{ sold: number }>(sql`select count(*)::int as sold from tickets where category_id = ${category.id} and status <> 'CANCELLED'`);
  const perMinute = (BUYERS / elapsed) * 60;
  console.log("\nENF-03 — ouverture de la vente");
  console.log(`  ${BUYERS} commandes simultanées traitées en ${elapsed.toFixed(1)} s → ${perMinute.toFixed(0)} commandes / minute (objectif ≥ 200)`);
  console.log(`  acceptées : ${ok.length} · refusées (complet) : ${BUYERS - ok.length} · billets en base : ${sold} / ${CAPACITY}`);
  console.log(`  temps de réponse : médiane ${ms(percentile(results.map((x) => x.latency), 50))}, p95 ${ms(percentile(results.map((x) => x.latency), 95))}`);
  const noOversell = Number(sold) <= CAPACITY && ok.length === Math.min(BUYERS, CAPACITY);

  // Paiements confirmés
  for (const x of ok) if (!("error" in x.r)) await db.transaction((tx) => markOrderPaid(tx, (x.r as { orderId: number }).orderId));
  const tokens = (await db.execute<{ token: string }>(sql`select token from tickets where event_id = ${event.id} and status = 'VALID'`)).map((r) => r.token);

  // ── ENF-02 : contrôle d'accès, chaque billet présenté une fois + 10 % de doublons, sur plusieurs portes
  const queue = [...tokens, ...tokens.slice(0, Math.ceil(tokens.length / 10))].sort(() => Math.random() - 0.5);
  const latencies: number[] = [];
  let accepted = 0;
  let duplicates = 0;
  const t1 = performance.now();
  await Promise.all(
    Array.from({ length: GATES }, async (_, gate) => {
      for (let token = queue.pop(); token; token = queue.pop()) {
        const start = performance.now();
        const r = await scanTicket(event.id, token, `Porte ${gate + 1}`, null as unknown as number);
        latencies.push(performance.now() - start);
        if (r.ok) accepted++;
        else if (r.reason === "ALREADY_USED") duplicates++;
      }
    }),
  );
  const scanSeconds = (performance.now() - t1) / 1000;
  const perSecond = latencies.length / scanSeconds;
  const p95 = percentile(latencies, 95);
  console.log("\nENF-02 — contrôle d'accès");
  console.log(`  ${latencies.length} lectures sur ${GATES} portes en ${scanSeconds.toFixed(1)} s → ${perSecond.toFixed(0)} lectures / s`);
  console.log(`  entrées acceptées : ${accepted} / ${tokens.length} · doublons refusés : ${duplicates}`);
  console.log(`  temps de réponse : médiane ${ms(percentile(latencies, 50))}, p95 ${ms(p95)}, max ${ms(Math.max(...latencies))} (objectif < 1 s)`);
  console.log(`  30 000 spectateurs à ce débit : ${(30_000 / perSecond / 60).toFixed(0)} min (objectif < 120 min)`);

  const checks = [
    ["ENF-03 débit ≥ 200 commandes / minute", perMinute >= 200],
    ["ENF-03 aucune survente", noOversell],
    ["ENF-02 chaque billet accepté une seule fois", accepted === tokens.length],
    ["ENF-02 p95 < 1 s par billet", p95 < 1000],
    ["ENF-02 30 000 entrées en moins de 2 h", 30_000 / perSecond < 7200],
  ] as const;
  console.log("\nRésultat");
  for (const [label, pass] of checks) console.log(`  ${pass ? "OK  " : "ÉCHEC"} ${label}`);
  return checks.every(([, pass]) => pass);
}

let success = false;
try {
  success = await main();
} finally {
  await cleanup();
  await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
}
process.exit(success ? 0 : 1);
