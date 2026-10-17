import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { formatAffiliationNumber } from "../lib/clubs";
import { db } from "../lib/db";
import { clubAffiliationSeq, clubs, documents, leagues } from "../lib/db/schema";
import { checkUpload, MIME } from "../lib/documents";
import { slugify } from "../lib/format";
import { nextVal } from "../lib/sequences";
import { putFile } from "../lib/storage";

/**
 * Import en lot de clubs affiliés avec leur logo : npm run clubs:import -- <dossier>
 * <dossier>/clubs.json : [{ name, shortName?, city, league (code de ligue), foundedYear?, logo? (fichier du dossier) }].
 * Un club déjà présent (même nom) n'est pas recréé ; son logo est ajouté s'il n'en a pas. Tout se modifie ensuite
 * dans Administration › Clubs.
 */
type Entry = { name: string; shortName?: string; city: string; league: string; foundedYear?: number; logo?: string };

const dir = process.argv[2];
if (!dir) throw new Error("Usage : npm run clubs:import -- <dossier>");
const entries: Entry[] = JSON.parse(await readFile(path.join(dir, "clubs.json"), "utf8"));
const leagueIds = new Map((await db.select({ id: leagues.id, code: leagues.code }).from(leagues)).map((l) => [l.code, l.id]));

for (const e of entries) {
  const leagueId = leagueIds.get(e.league);
  if (!leagueId) {
    console.error(`✗ ${e.name} : ligue inconnue ${e.league}`);
    continue;
  }
  let [club] = await db.select().from(clubs).where(eq(clubs.name, e.name)).limit(1);
  if (!club) {
    [club] = await db
      .insert(clubs)
      .values({
        name: e.name,
        shortName: e.shortName ?? null,
        city: e.city,
        leagueId,
        foundedYear: e.foundedYear ?? null,
        status: "AFFILIATED",
        slug: slugify(e.name),
        affiliationNumber: formatAffiliationNumber(await nextVal(clubAffiliationSeq)),
      })
      .returning();
  }
  let logo = "";
  if (e.logo) {
    const has = await db.$count(documents, and(eq(documents.ownerType, "club"), eq(documents.ownerId, club.id), eq(documents.type, "CLUB_LOGO")));
    if (!has) {
      const bytes = new Uint8Array(await readFile(path.join(dir, e.logo)));
      const checked = checkUpload("CLUB_LOGO", bytes);
      if ("error" in checked) logo = ` (logo refusé : ${checked.error})`;
      else {
        const storageKey = `club/${club.id}/${randomUUID()}.${checked.kind}`;
        await putFile(storageKey, bytes);
        await db.insert(documents).values({ ownerType: "club", ownerId: club.id, type: "CLUB_LOGO", storageKey, originalName: e.logo, contentType: MIME[checked.kind], size: bytes.length });
        logo = " + logo";
      }
    }
  }
  console.log(`✓ ${club.affiliationNumber} ${club.name} (${e.city})${logo}`);
}
process.exit(0);
