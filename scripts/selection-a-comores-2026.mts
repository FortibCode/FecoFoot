import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { nationalTeams, selectionPlayers, selections } from "../lib/db/schema";
import { putFile } from "../lib/storage";

/**
 * Liste des Diables Rouges A pour la double confrontation face aux Comores (13 et 17 novembre 2026),
 * dévoilée le 30 octobre 2026 par Claude Le Roy (source : Africa Top Sports), publiée sur le portail
 * (retrait possible depuis l'administration). Portraits : photos sous licence libre
 * de Wikimedia Commons, avec auteur et licence (crédit affiché sur le portail).
 *   npm run selection:a-comores
 */
const TITLE = "Éliminatoires CAN 2027 — Comores (13 et 17 novembre 2026)";
const PURPOSE =
  "Liste de 25 joueurs dévoilée le 30 octobre 2026 par le sélectionneur Claude Le Roy pour la double confrontation face aux Comores, 3e et 4e journées du groupe G des éliminatoires de la CAN 2027 : à Moroni le 13 novembre, à Brazzaville le 17 novembre.";

type Pos = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
type Entry = { name: string; club: string; country: string; position: Pos; playerId?: number; photo?: { url: string; credit: string } };

const commons = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`;

const PLAYERS: Entry[] = [
  { name: "Perrault Ndinga", club: "Tusker FC", country: "Kenya", position: "GOALKEEPER" },
  { name: "Trey Vimalin", club: "US Torcy", country: "France", position: "GOALKEEPER" },
  { name: "Melvin Zinga", club: "Angers SCO", country: "France", position: "GOALKEEPER" },
  { name: "Yhoan Andzouana", club: "Konyaspor", country: "Turquie", position: "DEFENDER" },
  { name: "Nehemiah Fernandez", club: "AS Nancy", country: "France", position: "DEFENDER" },
  { name: "Christ Makosso", club: "AJ Auxerre", country: "France", position: "DEFENDER" },
  {
    name: "Bradley Mazikou",
    club: "Servette FC",
    country: "Suisse",
    position: "DEFENDER",
    photo: { url: commons("Bradley Mazikou.jpg"), credit: "Biser Todorov · CC BY-SA 4.0 · Wikimedia Commons" },
  },
  { name: "Berilhod Mbemba", club: "Al Merrikh", country: "Soudan", position: "DEFENDER" },
  { name: "Kevin Mouanga", club: "Kasımpaşa", country: "Turquie", position: "DEFENDER" },
  {
    name: "Bryan Passi",
    club: "Valenciennes",
    country: "France",
    position: "DEFENDER",
    photo: { url: commons("Lens-Niort (21-12-2019) 40.jpg"), credit: "Supporterhéninois · CC0 · Wikimedia Commons" },
  },
  {
    name: "Morgan Poaty",
    club: "Lausanne-Sport",
    country: "Suisse",
    position: "DEFENDER",
    photo: { url: commons("Poaty MHSC.jpg"), credit: "34 super héros · CC BY-SA 4.0 · Wikimedia Commons" },
  },
  {
    name: "Fred Dembi",
    club: "Al-Hamriyah",
    country: "Émirats arabes unis",
    position: "MIDFIELDER",
    photo: { url: commons("Red Star-Ajaccio, 26-08-2024, Fred Dembi (cropped).jpg"), credit: "Paul Vaurie · CC0 · Wikimedia Commons" },
  },
  { name: "William Hondermarck", club: "Bromley", country: "Angleterre", position: "MIDFIELDER" },
  { name: "Inno Loemba", club: "Simba SC", country: "Tanzanie", position: "MIDFIELDER" },
  {
    name: "Antoine Makoumbou",
    club: "Sampdoria",
    country: "Italie",
    position: "MIDFIELDER",
    photo: { url: commons("Antoine Makoumbou (cropped).jpg"), credit: "Samsunspor · CC BY 4.0 · Wikimedia Commons" },
  },
  { name: "Gaius Makouta", club: "Alanyaspor", country: "Turquie", position: "MIDFIELDER" },
  { name: "Chandrel Massanga", club: "Eyüpspor", country: "Turquie", position: "MIDFIELDER" },
  { name: "Merveil Ndockyt", club: "AS FAR", country: "Maroc", position: "MIDFIELDER" },
  // Au registre national (CARA Brazzaville) : relié à sa fiche.
  { name: "Gestany Bantsiele", club: "CARA Brazzaville", country: "Congo", position: "FORWARD", playerId: 2074 },
  { name: "Mons Bassouamina", club: "CS Marítimo", country: "Portugal", position: "FORWARD" },
  {
    name: "Thievy Bifouma",
    club: "Persepolis FC",
    country: "Iran",
    position: "FORWARD",
    photo: { url: commons("Thievy Bifouma Persepolis FC.jpg"), credit: "PirooziFC · CC0 · Wikimedia Commons" },
  },
  { name: "Dimi Ikia", club: "Górnik Zabrze", country: "Pologne", position: "FORWARD" },
  { name: "Guy Mbenza", club: "LN Tieren", country: "Chine", position: "FORWARD" },
  { name: "Jordi Mboula", club: "AE Kifisia", country: "Grèce", position: "FORWARD" },
  { name: "Beni Namboka", club: "Manema Union", country: "RD Congo", position: "FORWARD" },
];

const EXT: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

async function download(url: string) {
  // Politique de Wikimedia : un User-Agent qui identifie l'outil.
  const res = await fetch(url, { headers: { "User-Agent": "FECOFOOT-platform/1.0 (import de portraits sous licence libre)" } });
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !EXT[type]) throw new Error(`${res.status} ${type}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) throw new Error("plus de 5 Mo");
  return { bytes, ext: EXT[type] };
}

const [team] = await db.select().from(nationalTeams).where(eq(nationalTeams.code, "A")).limit(1);
if (!team) throw new Error("Sélection A introuvable.");
const [existing] = await db.select().from(selections).where(and(eq(selections.teamId, team.id), eq(selections.title, TITLE))).limit(1);
if (existing) {
  console.log(`Liste déjà enregistrée (n° ${existing.id}, ${existing.status}).`);
  process.exit(0);
}

const [sel] = await db.insert(selections).values({ teamId: team.id, title: TITLE, purpose: PURPOSE, status: "PUBLISHED", publishedAt: new Date() }).returning();
for (const p of PLAYERS) {
  let photoKey: string | null = null;
  if (p.photo) {
    try {
      const { bytes, ext } = await download(p.photo.url);
      const key = `convoques/${sel.id}/${randomUUID()}.${ext}`;
      await putFile(key, bytes);
      photoKey = key;
    } catch (e) {
      console.error(`✗ photo de ${p.name} : ${(e as Error).message}`);
    }
  }
  await db.insert(selectionPlayers).values(
    p.playerId
      ? { selectionId: sel.id, playerId: p.playerId, position: p.position }
      : {
          selectionId: sel.id,
          externalName: p.name,
          externalClub: p.club,
          externalCountry: p.country,
          position: p.position,
          photoKey,
          photoCredit: photoKey ? p.photo!.credit : null,
        },
  );
  console.log(`✓ ${p.name}${photoKey ? " (photo)" : ""}`);
}
console.log(`Liste n° ${sel.id} publiée : ${PLAYERS.length} joueurs.`);
process.exit(0);
