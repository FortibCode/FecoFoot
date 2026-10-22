import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "../lib/db";
import { auditLogs, championships, leagues } from "../lib/db/schema";
import { MIME, sniffKind } from "../lib/documents";
import { imageSize } from "../lib/image-size";
import { deleteFile, putFile } from "../lib/storage";

/**
 * Logos officiels : npm run logos:officiels -- <logo Ligue 1> <écusson des ligues départementales>
 *  - le logo « Ligue 1 — Ligue nationale de football » devient celui du championnat Ligue 1 ;
 *  - l'écusson « Congo FECOFOOT » devient le logo de chaque ligue départementale (remplace l'ancien).
 * JPEG, PNG ou WebP. Modifiable ensuite pièce par pièce dans l'administration.
 */
const [ligue1File, liguesFile] = process.argv.slice(2);
if (!ligue1File || !liguesFile) throw new Error("Usage : npm run logos:officiels -- <logo Ligue 1> <écusson des ligues>");

async function load(file: string) {
  const bytes = new Uint8Array(await readFile(file));
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf" || !imageSize(bytes)) throw new Error(`${file} : format non accepté (JPEG, PNG ou WebP).`);
  return { bytes, kind, type: MIME[kind] };
}
const audit = (entity: string, entityId: number, file: string) =>
  db.insert(auditLogs).values({ userId: null, action: "LOGO", entity, entityId: String(entityId), details: { file, script: "logos-officiels" } });

const l1 = await load(ligue1File);
const [ch] = await db.select().from(championships).where(eq(championships.code, "ligue-1")).limit(1);
if (!ch) throw new Error("Championnat Ligue 1 introuvable.");
const chKey = `championships/${ch.id}/${randomUUID()}.${l1.kind}`;
await putFile(chKey, l1.bytes);
await db.update(championships).set({ logoKey: chKey, logoType: l1.type, updatedAt: new Date() }).where(eq(championships.id, ch.id));
if (ch.logoKey) await deleteFile(ch.logoKey);
await audit("championship", ch.id, ligue1File);
console.log(`✓ ${ch.name} : logo enregistré`);

const crest = await load(liguesFile);
for (const l of await db.select().from(leagues).where(isNotNull(leagues.id))) {
  const key = `leagues/${l.id}/${randomUUID()}.${crest.kind}`;
  await putFile(key, crest.bytes);
  await db.update(leagues).set({ logoKey: key, logoType: crest.type, updatedAt: new Date() }).where(eq(leagues.id, l.id));
  if (l.logoKey) await deleteFile(l.logoKey);
  await audit("league", l.id, liguesFile);
  console.log(`✓ ${l.name} : écusson enregistré`);
}
process.exit(0);
