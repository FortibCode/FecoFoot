import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { championships, leagues, nationalTeams, users } from "../lib/db/schema";
import { NATIONAL_TEAMS } from "../lib/national-teams";

/** Données de référence : les 11 ligues départementales (EF-CLB-01), les 6 sélections nationales (EF-SEL-01) et le premier super administrateur. */

const LEAGUES = [
  { code: "BOU", name: "Ligue départementale de la Bouenza", department: "Bouenza" },
  { code: "BZV", name: "Ligue départementale de Brazzaville", department: "Brazzaville" },
  { code: "CUV", name: "Ligue départementale de la Cuvette", department: "Cuvette" },
  { code: "CUO", name: "Ligue départementale de la Cuvette-Ouest", department: "Cuvette-Ouest" },
  { code: "KOU", name: "Ligue départementale du Kouilou", department: "Kouilou" },
  { code: "LEK", name: "Ligue départementale de la Lékoumou", department: "Lékoumou" },
  { code: "LIK", name: "Ligue départementale de la Likouala", department: "Likouala" },
  { code: "NIA", name: "Ligue départementale du Niari", department: "Niari" },
  { code: "PLA", name: "Ligue départementale des Plateaux", department: "Plateaux" },
  { code: "POO", name: "Ligue départementale du Pool", department: "Pool" },
  { code: "SAN", name: "Ligue départementale de la Sangha", department: "Sangha" },
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  throw new Error("SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (12 caractères minimum) doivent être définis.");
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

await db.insert(leagues).values(LEAGUES).onConflictDoNothing({ target: leagues.code });
// Championnats nationaux (structures permanentes ; les saisons se créent depuis l'espace fédéral).
await db
  .insert(championships)
  .values([
    { code: "ligue-1", name: "Ligue 1", tier: 1, description: "Championnat national de première division." },
    { code: "ligue-2", name: "Ligue 2", tier: 2, description: "Championnat national de deuxième division." },
  ])
  .onConflictDoNothing({ target: championships.code });
// Les six sélections nationales (EF-SEL-01).
await db
  .insert(nationalTeams)
  .values(NATIONAL_TEAMS.map(({ code, name, slug }) => ({ code, name, slug })))
  .onConflictDoNothing({ target: nationalTeams.code });
await db
  .insert(users)
  .values({
    email,
    fullName: process.env.SEED_ADMIN_NAME ?? "Administrateur plateforme",
    passwordHash: await bcrypt.hash(password, 12),
    role: "SUPER_ADMIN",
  })
  .onConflictDoNothing({ target: users.email });

await client.end();
console.log(`${LEAGUES.length} ligues, ${NATIONAL_TEAMS.length} sélections et le super administrateur ${email} sont en place.`);
