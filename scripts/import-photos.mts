import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { nationalTeams, photos } from "../lib/db/schema";
import { storePhoto } from "../lib/photos";

/**
 * Import en lot dans la photothèque :
 *   npm run photos:import -- <dossier> [--equipe a] [--une fichier.jpg]
 * Légendes facultatives dans <dossier>/legendes.json : { "fichier.jpg": "Légende" }.
 * --equipe : slug de la sélection (a, a-locaux, u23, u20, u17, dames) ; --une : photo du bandeau d'accueil.
 */
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--equipe" && args[args.indexOf(a) - 1] !== "--une");
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
if (!dir) throw new Error("Usage : npm run photos:import -- <dossier> [--equipe a] [--une fichier.jpg]");

let teamId: number | null = null;
const slug = opt("--equipe");
if (slug) {
  const [t] = await db.select().from(nationalTeams).where(eq(nationalTeams.slug, slug)).limit(1);
  if (!t) throw new Error(`Sélection inconnue : ${slug}`);
  teamId = t.id;
}
const captions: Record<string, string> = await readFile(path.join(dir, "legendes.json"), "utf8").then(JSON.parse, () => ({}));
const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
const featured = opt("--une");

// Ordre inverse : la première du dossier est la plus récente, donc affichée en tête.
for (const file of [...files].reverse()) {
  const result = await storePhoto({ bytes: new Uint8Array(await readFile(path.join(dir, file))), teamId, caption: captions[file] ?? "", createdBy: null });
  if ("error" in result) {
    console.error(`✗ ${file} : ${result.error}`);
    continue;
  }
  if (file === featured) {
    await db.update(photos).set({ featured: false }).where(eq(photos.featured, true));
    await db.update(photos).set({ featured: true }).where(eq(photos.id, result.photo.id));
  }
  console.log(`✓ ${file} → photo ${result.photo.id}${file === featured ? " (à la une)" : ""}`);
}
process.exit(0);
