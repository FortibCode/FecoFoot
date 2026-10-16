import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { leagues, nationalTeams, users } from "../lib/db/schema";
import { NATIONAL_TEAMS } from "../lib/national-teams";

/** Données de référence : les 12 ligues départementales (EF-CLB-01), les 6 sélections nationales (EF-SEL-01) et le premier super administrateur. */

const LEAGUES = [
  { code: "BZV", name: "Ligue de Brazzaville" },
  { code: "PNR", name: "Ligue de Pointe-Noire" },
  { code: "BOU", name: "Ligue de la Bouenza" },
  { code: "CUV", name: "Ligue de la Cuvette" },
  { code: "CUO", name: "Ligue de la Cuvette-Ouest" },
  { code: "KOU", name: "Ligue du Kouilou" },
  { code: "LEK", name: "Ligue de la Lékoumou" },
  { code: "LIK", name: "Ligue de la Likouala" },
  { code: "NIA", name: "Ligue du Niari" },
  { code: "PLA", name: "Ligue des Plateaux" },
  { code: "POO", name: "Ligue du Pool" },
  { code: "SAN", name: "Ligue de la Sangha" },
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
