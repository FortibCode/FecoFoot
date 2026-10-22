import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { formatAccreditationNumber } from "../lib/accreditations";
import { roundRobin } from "../lib/competitions";
import { formatFederalId, formatLicenseNumber, identityKey, naturalCategory, seasonExpiry, seasonOf } from "../lib/licenses";
import { matchDay } from "../lib/referees";
import { formatFanId } from "../lib/supporters";
import { formatTicketNumber } from "../lib/ticketing";
import { formatTransferNumber } from "../lib/transfers";

/**
 * Données de DÉMONSTRATION (jamais en production) : affichage des licences, du championnat, de la billetterie,
 * des paiements, des accréditations et des désignations.
 *
 * Joueurs : les vrais noms et clubs de la liste U23 fournie par la fédération (sélection déjà en base) ;
 * tout le reste (dates de naissance, licences, résultats, buts, transfert) est fictif. Aucune sanction
 * disciplinaire n'est attribuée à un joueur réel. Supporters, journalistes et arbitres : noms fictifs.
 *
 * Tout ce qui est créé est inscrit au journal d'audit (action DEMO_SEED) : `npm run demo:purge` le supprime.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
if (process.env.NODE_ENV === "production" || process.env.PAYMENT_MODE === "live") throw new Error("Données de démonstration interdites en production.");
const sql = postgres(url, { max: 1 });

const token = () => randomBytes(24).toString("base64url");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
// Séquences lues dans la transaction en cours (une seule connexion : une 2e requête attendrait la fin de la transaction).
const next = async (tx: postgres.TransactionSql, seq: string) => Number((await tx`select nextval(${seq}) as n`)[0].n);
// Aléa reproductible : mêmes données à chaque chargement.
let seed = 20260922;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const DAY = 86_400_000;
const at = (iso: string) => new Date(`${iso}+01:00`); // heure de Brazzaville

const [existing] = await sql`select 1 from audit_logs where action = 'DEMO_SEED' and not exists (select 1 from audit_logs p where p.action = 'DEMO_PURGE' and p.id > audit_logs.id) limit 1`;
if (existing) {
  console.log("Données de démonstration déjà chargées. Pour recommencer : npm run demo:purge, puis npm run demo:seed.");
  await sql.end();
  process.exit(0);
}

const [admin] = await sql`select id from users where role = 'SUPER_ADMIN' order by id limit 1`;
const [l1] = await sql`select c.* from competitions c join championships ch on ch.id = c.championship_id where ch.code = 'ligue-1' order by c.season desc limit 1`;
if (!admin || !l1) throw new Error("Super administrateur ou saison de Ligue 1 introuvable (npm run db:seed, npm run divisions:nationales).");
const season = seasonOf();
const now = new Date();
const created: Record<string, number[]> = { players: [], licenses: [], transfers: [], referees: [], supporters: [], events: [], orders: [], payments: [], accreditations: [], matches: [] };

await sql.begin(async (tx) => {
  // ── Joueurs et licences : la liste U23 (noms et clubs réels) ─────────────────
  const roster = await tx`
    select sp.external_name as name, sp.position, c.id as club_id, c.name as club
    from selection_players sp join clubs c on c.name = sp.external_club
    order by c.name, sp.external_name`;
  const players: { id: number; clubId: number; position: string; name: string }[] = [];
  for (const [i, r] of roster.entries()) {
    const [lastName, ...rest] = String(r.name).split(" ");
    const firstName = rest.join(" ") || "—";
    const birth = new Date(Date.UTC(2003 + (i % 4), (i * 5) % 12, 1 + ((i * 7) % 27)));
    const iso = birth.toISOString().slice(0, 10);
    const [p] = await tx`
      insert into players (federal_id, last_name, first_name, birth_date, gender, nationality, position, club_id, identity_key, created_by)
      values (${formatFederalId(now.getFullYear(), await next(tx, "player_federal_seq"))}, ${lastName}, ${firstName}, ${iso}, 'M', 'Congolaise', ${r.position}, ${r.club_id}, ${identityKey(lastName, firstName, iso)}, ${admin.id})
      returning id`;
    players.push({ id: p.id, clubId: r.club_id, position: r.position, name: r.name });
    created.players.push(p.id);

    // Licences de la saison : validées pour la plupart ; quelques-unes en attente, payée, refusée.
    const status = i % 9 === 4 ? "PENDING" : i % 9 === 6 ? "PAID" : i === 13 ? "REJECTED" : "VALIDATED";
    const requested = new Date(now.getTime() - (40 - (i % 20)) * DAY);
    const [lic] = await tx`
      insert into licenses (number, player_id, club_id, season, category, type, status, medical_check_date, fee_amount, paid_at, payment_ref,
        validated_at, validated_by, decision_reason, expires_at, verify_token, requested_by, created_at, updated_at)
      values (${formatLicenseNumber(season, await next(tx, "license_number_seq"))}, ${p.id}, ${r.club_id}, ${season}, ${naturalCategory(birth, season)}, 'AMATEUR', ${status},
        ${new Date(requested.getTime() - 10 * DAY).toISOString().slice(0, 10)}, 5000,
        ${status === "PENDING" ? null : requested}, ${status === "PENDING" ? null : `DEMO-${i}`},
        ${status === "VALIDATED" ? new Date(requested.getTime() + 3 * DAY) : status === "REJECTED" ? new Date(requested.getTime() + 2 * DAY) : null},
        ${status === "VALIDATED" || status === "REJECTED" ? admin.id : null},
        ${status === "REJECTED" ? "Certificat médical illisible : merci de déposer une copie lisible (démonstration)." : null},
        ${seasonExpiry(season)}, ${token()}, ${admin.id}, ${requested}, ${requested})
      returning id`;
    created.licenses.push(lic.id);
  }

  // Un transfert en cours d'instruction (prêt), pour l'affichage du module.
  const loan = players.find((p) => p.name.startsWith("LOUBAKI"));
  const [inter] = await tx`select id from clubs where name = 'Inter Club'`;
  if (loan && inter) {
    const [t] = await tx`
      insert into transfers (number, player_id, from_club_id, to_club_id, type, fee, loan_end_date, season, status, created_by)
      values (${formatTransferNumber(season, await next(tx, "transfer_number_seq"))}, ${loan.id}, ${loan.clubId}, ${inter.id}, 'LOAN', 0, ${`${season + 1}-06-30`}, ${season}, 'PENDING', ${admin.id})
      returning id`;
    created.transfers.push(t.id);
  }

  // ── Ligue 1 National : calendrier, 5 journées jouées, un match en direct, un résultat à valider ──
  const teams = (await tx`select club_id from competition_teams where competition_id = ${l1.id} order by club_id`).map((t) => t.club_id as number);
  const clubInfo = new Map((await tx`select id, city from clubs where id in ${tx(teams)}`).map((c) => [c.id as number, c.city as string]));
  const venue = (clubId: number) => {
    const city = clubInfo.get(clubId) ?? "";
    if (city === "Brazzaville") return "Stade Alphonse Massamba-Débat";
    if (city === "Pointe-Noire") return "Stade municipal de Pointe-Noire";
    return `Stade municipal de ${city}`;
  };
  const byClub = new Map<number, typeof players>();
  for (const p of players) byClub.set(p.clubId, [...(byClub.get(p.clubId) ?? []), p]);
  const scorerOf = (clubId: number) => {
    const squad = byClub.get(clubId) ?? [];
    const attackers = squad.filter((p) => p.position === "FORWARD" || p.position === "MIDFIELDER");
    return pick(attackers.length ? attackers : squad);
  };

  await tx`update competitions set status = 'ONGOING', relegation_spots = 2 where id = ${l1.id}`;
  const firstSaturday = at(`${season}-09-19T15:30:00`);
  const fixtures = roundRobin(teams, { doubleRound: l1.double_round });
  let liveSet = false;
  let pendingSet = false;
  for (const f of fixtures) {
    let kickoff = new Date(firstSaturday.getTime() + (f.round - 1) * 7 * DAY);
    let status = kickoff < now ? "FINISHED" : "SCHEDULED";
    // Un match de la prochaine journée avancé à aujourd'hui, en cours (saisie officielle du commissaire).
    if (!liveSet && status === "SCHEDULED") {
      kickoff = new Date(now.getTime() - 35 * 60_000);
      status = "LIVE";
      liveSet = true;
    }
    const [m] = await tx`
      insert into matches (competition_id, round, home_club_id, away_club_id, kickoff_at, venue, status, updated_by)
      values (${l1.id}, ${f.round}, ${f.home}, ${f.away}, ${kickoff}, ${venue(f.home)}, ${status}, ${admin.id})
      returning id`;
    created.matches.push(m.id);
    if (status === "SCHEDULED") continue;

    const home = Math.floor(rand() * (status === "LIVE" ? 2 : 4));
    const away = Math.floor(rand() * (status === "LIVE" ? 2 : 3));
    // Buts attribués seulement si les deux clubs ont des joueurs en base (sinon : score saisi directement).
    const withScorers = byClub.has(f.home) && byClub.has(f.away);
    if (withScorers) {
      const goals = [...Array(home).fill(f.home), ...Array(away).fill(f.away)] as number[];
      for (const clubId of goals) {
        const p = scorerOf(clubId);
        await tx`insert into match_events (match_id, type, minute, club_id, player_id, created_by) values (${m.id}, 'GOAL', ${1 + Math.floor(rand() * (status === "LIVE" ? 34 : 90))}, ${clubId}, ${p.id}, ${admin.id})`;
      }
    }
    // Le dernier match joué reste « en attente de validation » (saisi par le commissaire).
    const lastPlayedRound = Math.floor((now.getTime() - firstSaturday.getTime()) / (7 * DAY)) + 1;
    const awaiting = status === "FINISHED" && !pendingSet && f.round === lastPlayedRound;
    if (awaiting) pendingSet = true;
    await tx`
      update matches set home_score = ${home}, away_score = ${away},
        attendance = ${status === "FINISHED" ? 1500 + Math.floor(rand() * 9000) : null},
        validated_at = ${status === "FINISHED" && !awaiting ? new Date(kickoff.getTime() + 3 * 3600_000) : null},
        validated_by = ${status === "FINISHED" && !awaiting ? admin.id : null}
      where id = ${m.id}`;
  }

  // ── Arbitres (noms fictifs) et désignations des deux prochaines journées ─────
  const refs = [
    ["MAKAYA", "Hervé", "FIFA"],
    ["NGOMA", "Clarisse", "ELITE"],
    ["MPASSI", "Arsène", "NATIONAL"],
    ["OBA", "Christian", "NATIONAL"],
    ["BIYOUDI", "Régis", "NATIONAL"],
    ["ITOUA", "Fabrice", "LEAGUE"],
  ];
  const refIds: number[] = [];
  for (const [i, [lastName, firstName, grade]] of refs.entries()) {
    const [r] = await tx`
      insert into referees (last_name, first_name, grade, phone, email)
      values (${lastName}, ${firstName}, ${grade}, ${`06 600 00${String(10 + i)}`}, ${`arbitre${i + 1}@demo.fecofoot.cg`}) returning id`;
    refIds.push(r.id);
    created.referees.push(r.id);
  }
  // Deux matchs désignés par journée sur les deux prochaines journées (un arbitre : un match par jour, RG-08) ;
  // les autres matchs restent sans arbitre et apparaissent au tableau de bord.
  const upcoming = await tx`
    select id, kickoff_at, round from matches
    where competition_id = ${l1.id} and status = 'SCHEDULED'
      and round in (select distinct round from matches where competition_id = ${l1.id} and status = 'SCHEDULED' order by round limit 2)
    order by round, id`;
  const rounds = [...new Set(upcoming.map((m) => m.round as number))];
  for (const round of rounds) {
    for (const [i, m] of upcoming.filter((u) => u.round === round).slice(0, 2).entries()) {
      for (const [k, role] of (["REFEREE", "ASSISTANT_1", "ASSISTANT_2"] as const).entries()) {
        await tx`insert into match_officials (match_id, referee_id, role, match_day) values (${m.id}, ${refIds[i * 3 + k]}, ${role}, ${matchDay(m.kickoff_at)})`;
      }
    }
  }

  // ── Supporters (noms fictifs) ────────────────────────────────────────────────
  const fans = [
    ["MOUKOKO", "Grâce"],
    ["NDINGA", "Patrick"],
    ["SAMBA", "Merveille"],
    ["MALONGA", "Junior"],
    ["BAKALA", "Prisca"],
    ["NZAOU", "Dieudonné"],
    ["KIMBEMBE", "Sandra"],
    ["OKEMBA", "Rodrigue"],
  ];
  const passwordHash = await bcrypt.hash(token(), 10);
  const fanIds: { id: number; name: string; phone: string }[] = [];
  for (const [i, [lastName, firstName]] of fans.entries()) {
    const phone = `06${String(5550000 + i * 137).padStart(7, "0")}`;
    const [s] = await tx`
      insert into supporters (fan_id, last_name, first_name, birth_date, phone, email, password_hash, id_document_type, id_document_number, id_verified_at, consent_at, created_at)
      values (${formatFanId(await next(tx, "fan_id_seq"))}, ${lastName}, ${firstName}, ${`19${85 + i}-0${1 + (i % 9)}-1${i}`}, ${phone}, ${`supporter${i + 1}@demo.fecofoot.cg`},
        ${passwordHash}, 'CNI', ${`DEMO-${100200 + i}`}, ${i % 3 === 0 ? null : now}, ${now}, ${new Date(now.getTime() - (60 - i * 5) * DAY)})
      returning id`;
    fanIds.push({ id: s.id, name: `${firstName} ${lastName}`, phone });
    created.supporters.push(s.id);
  }

  // ── Billetterie : match des Diables Rouges (prévente), prochain choc de Ligue 1 (en vente), match passé (clos) ──
  const [carDerby] = await tx`
    select m.id, m.kickoff_at, m.venue, h.name as home, a.name as away from matches m
    join clubs h on h.id = m.home_club_id join clubs a on a.id = m.away_club_id
    where m.competition_id = ${l1.id} and m.status = 'SCHEDULED' and m.venue = 'Stade Alphonse Massamba-Débat' order by m.kickoff_at limit 1`;
  const [pastDerby] = await tx`
    select m.kickoff_at, m.venue, h.name as home, a.name as away from matches m
    join clubs h on h.id = m.home_club_id join clubs a on a.id = m.away_club_id
    where m.competition_id = ${l1.id} and m.status = 'FINISHED' and m.venue = 'Stade Alphonse Massamba-Débat' order by m.kickoff_at desc limit 1`;
  const [nationalFixture] = await tx`select kickoff_at, venue, opponent from national_fixtures where status = 'SCHEDULED' and is_home = true order by kickoff_at limit 1`;
  const eventDefs = [
    nationalFixture && {
      title: `Congo – ${nationalFixture.opponent} (Diables Rouges)`,
      kind: "NATIONAL_TEAM",
      venue: nationalFixture.venue ?? "Stade Alphonse Massamba-Débat, Brazzaville",
      kickoff: nationalFixture.kickoff_at,
      sales: "PRESALE",
      cats: [
        ["Tribune d'honneur", "Porte A", 400, 15000, 12000],
        ["Tribune couverte", "Porte B", 4000, 5000, 4000],
        ["Virages", "Porte F", 12000, 1000, 1000],
      ],
    },
    carDerby && {
      title: `Ligue 1 National : ${carDerby.home} – ${carDerby.away}`,
      kind: "LEAGUE",
      venue: carDerby.venue,
      kickoff: carDerby.kickoff_at,
      sales: "OPEN",
      cats: [
        ["Tribune d'honneur", "Porte A", 200, 5000, 4000],
        ["Tribune couverte", "Porte B", 2500, 2000, 1500],
        ["Virages", "Porte F", 6000, 500, 500],
      ],
    },
    pastDerby && {
      title: `Ligue 1 National : ${pastDerby.home} – ${pastDerby.away}`,
      kind: "LEAGUE",
      venue: pastDerby.venue,
      kickoff: pastDerby.kickoff_at,
      sales: "CLOSED",
      cats: [
        ["Tribune couverte", "Porte B", 2500, 2000, 1500],
        ["Virages", "Porte F", 6000, 500, 500],
      ],
    },
  ].filter(Boolean) as { title: string; kind: string; venue: string; kickoff: Date; sales: string; cats: [string, string, number, number, number][] }[];

  for (const [e, def] of eventDefs.entries()) {
    const slug = `demo-${def.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${e}`;
    const [ev] = await tx`
      insert into ticket_events (slug, title, kind, venue, kickoff_at, sales_status, max_tickets_per_fan)
      values (${slug}, ${def.title}, ${def.kind}, ${def.venue}, ${def.kickoff}, ${def.sales}, 4) returning id`;
    created.events.push(ev.id);
    const cats: { id: number; price: number; gate: string }[] = [];
    for (const [k, [name, gate, capacity, pub, member]] of def.cats.entries()) {
      const [c] = await tx`
        insert into ticket_categories (event_id, name, gate, capacity, public_price, member_price, sort_order)
        values (${ev.id}, ${name}, ${gate}, ${capacity}, ${pub}, ${member}, ${k}) returning id`;
      cats.push({ id: c.id, price: pub, gate });
    }

    // Commandes : payées en ligne (Mobile Money), au guichet, en attente, échouée.
    const past = def.sales === "CLOSED";
    for (const [i, fan] of fanIds.entries()) {
      if (def.sales === "PRESALE" && i > 3) break;
      const kind = past ? "PAID" : i === 5 ? "PENDING" : i === 6 ? "FAILED" : "PAID";
      const channel = i === 4 ? "COUNTER" : "ONLINE";
      const qty = 1 + (i % 3);
      const cat = cats[i % cats.length];
      const total = qty * cat.price;
      const orderedAt = new Date((past ? def.kickoff.getTime() : now.getTime()) - (10 - i) * DAY);
      const status = kind === "PAID" ? "PAID" : kind === "PENDING" ? "PENDING" : "EXPIRED";
      const [o] = await tx`
        insert into ticket_orders (reference, event_id, supporter_id, channel, status, total, expires_at, sold_by, paid_at, created_at)
        values (${`CMD-${randomBytes(4).toString("hex").toUpperCase()}`}, ${ev.id}, ${fan.id}, ${channel}, ${status}, ${total},
          ${kind === "PENDING" ? new Date(now.getTime() + 10 * 60_000) : null}, ${channel === "COUNTER" ? admin.id : null},
          ${kind === "PAID" ? orderedAt : null}, ${orderedAt})
        returning id`;
      created.orders.push(o.id);
      for (let t = 0; t < qty; t++) {
        const used = past && t === 0;
        await tx`
          insert into tickets (number, order_id, event_id, category_id, holder_name, holder_supporter_id, price, token, status, used_at, used_gate, scanned_by)
          values (${formatTicketNumber(await next(tx, "ticket_number_seq"))}, ${o.id}, ${ev.id}, ${cat.id}, ${t === 0 ? fan.name : `${fan.name} (invité ${t})`},
            ${t === 0 ? fan.id : null}, ${cat.price}, ${token()},
            ${kind === "PAID" ? (used ? "USED" : "VALID") : kind === "PENDING" ? "RESERVED" : "CANCELLED"},
            ${used ? new Date(def.kickoff.getTime() - 40 * 60_000) : null}, ${used ? cat.gate : null}, ${used ? admin.id : null})`;
      }
      if (channel === "COUNTER") continue;
      const method = i % 2 === 0 ? "MTN_MOMO" : "AIRTEL_MONEY";
      const pstatus = kind === "PAID" ? "SUCCEEDED" : kind === "PENDING" ? "PENDING" : "FAILED";
      const [p] = await tx`
        insert into payments (reference, purpose, target_id, method, phone, supporter_id, amount, status, provider_ref, failure_reason, created_at, confirmed_at)
        values (${`PAY-TKT-DEMO${randomBytes(3).toString("hex").toUpperCase()}`}, 'TICKET_ORDER', ${o.id}, ${method}, ${fan.phone}, ${fan.id}, ${total}, ${pstatus},
          ${`SIM-DEMO-${o.id}`}, ${pstatus === "FAILED" ? "Solde insuffisant (démonstration)" : null}, ${orderedAt}, ${pstatus === "SUCCEEDED" ? orderedAt : null})
        returning id`;
      created.payments.push(p.id);
    }

    // Accréditations presse sur le match des Diables Rouges (médias congolais, journalistes fictifs).
    if (def.kind === "NATIONAL_TEAM") {
      const press = [
        ["MBOUNGOU", "Alain", "Télé Congo", "CAMERA", "APPROVED"],
        ["LOEMBA", "Nadège", "Les Dépêches de Brazzaville", "JOURNALIST", "APPROVED"],
        ["NKOUKA", "Steve", "Radio Congo", "RADIO", "PENDING"],
        ["OYOBA", "Cédric", "Photographe indépendant", "PHOTOGRAPHER", "REFUSED"],
      ] as const;
      for (const [i, [lastName, firstName, outlet, role, status]] of press.entries()) {
        const [a] = await tx`
          insert into accreditations (number, event_id, last_name, first_name, phone, email, outlet, role, press_card_number, requested_zones, granted_zones,
            status, decision_reason, decided_by, decided_at, tracking_hash, badge_token)
          values (${formatAccreditationNumber(await next(tx, "accreditation_number_seq"))}, ${ev.id}, ${lastName}, ${firstName}, ${`05${String(4440000 + i * 97)}`},
            ${`presse${i + 1}@demo.fecofoot.cg`}, ${outlet}, ${role}, ${`CP-DEMO-${300 + i}`},
            ${sql.array(role === "PHOTOGRAPHER" || role === "CAMERA" ? ["PITCHSIDE", "MIXED_ZONE"] : ["PRESS_BOX", "PRESS_CONFERENCE"])}::press_zone[],
            ${status === "APPROVED" ? sql.array(role === "CAMERA" ? ["PITCHSIDE", "MIXED_ZONE"] : ["PRESS_BOX", "PRESS_CONFERENCE"]) : null}::press_zone[],
            ${status}, ${status === "REFUSED" ? "Carte de presse expirée (démonstration)." : null},
            ${status === "PENDING" ? null : admin.id}, ${status === "PENDING" ? null : now}, ${hash(token())}, ${token()})
          returning id`;
        created.accreditations.push(a.id);
      }
    }
  }

  // Frais de licence payés en Mobile Money (pour la trésorerie).
  const paidLicenses = await tx`select id, fee_amount from licenses where id in ${tx(created.licenses)} and status in ('VALIDATED', 'PAID') order by id limit 6`;
  for (const [i, l] of paidLicenses.entries()) {
    const [p] = await tx`
      insert into payments (reference, purpose, target_id, method, phone, user_id, amount, status, provider_ref, created_at, confirmed_at)
      values (${`PAY-LIC-DEMO${randomBytes(3).toString("hex").toUpperCase()}`}, 'LICENSE_FEE', ${l.id}, ${i % 2 ? "AIRTEL_MONEY" : "MTN_MOMO"}, '066000000', ${admin.id},
        ${l.fee_amount}, 'SUCCEEDED', ${`SIM-DEMO-L${l.id}`}, ${new Date(now.getTime() - (20 - i) * DAY)}, ${new Date(now.getTime() - (20 - i) * DAY)})
      returning id`;
    created.payments.push(p.id);
  }

  await tx`insert into audit_logs (user_id, action, entity, entity_id, details) values (${admin.id}, 'DEMO_SEED', 'demo', ${String(l1.id)}, ${tx.json(created)})`;
});

console.log("Données de démonstration chargées :");
for (const [k, v] of Object.entries(created)) console.log(`  ${k.padEnd(15)} ${v.length}`);
await sql.end();
