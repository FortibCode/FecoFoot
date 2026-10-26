import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, gt, inArray, asc } from "drizzle-orm";
import { formatAccreditationNumber } from "../lib/accreditations";
import { db } from "../lib/db";
import { accreditationNumberSeq, accreditations, auditLogs, ticketEvents } from "../lib/db/schema";
import { nextVal } from "../lib/sequences";
import { putFile } from "../lib/storage";

/**
 * Badge presse de DÉMONSTRATION (journaliste fictif, silhouette à la place d'une photo) pour voir le badge :
 *   npm run demo:badge
 * Affiche l'adresse du badge. Inscrit au journal (DEMO_SEED) : `npm run demo:purge` le supprime.
 */
if (process.env.NODE_ENV === "production") throw new Error("Données de démonstration interdites en production.");
const [event] = await db
  .select()
  .from(ticketEvents)
  .where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN", "CLOSED"]), gt(ticketEvents.kickoffAt, new Date())))
  .orderBy(asc(ticketEvents.kickoffAt))
  .limit(1);
if (!event) throw new Error("Aucun match à venir.");
const photo = await readFile(path.join(import.meta.dirname, "assets", "demo-silhouette.png"));
const photoKey = `accreditations/${event.id}/${randomUUID()}.png`;
await putFile(photoKey, new Uint8Array(photo));
const badgeToken = randomBytes(24).toString("base64url");
const [acc] = await db
  .insert(accreditations)
  .values({
    number: formatAccreditationNumber(await nextVal(accreditationNumberSeq)),
    eventId: event.id,
    lastName: "EXEMPLE",
    firstName: "Journaliste",
    phone: `+24206${String(Date.now()).slice(-7)}`,
    outlet: "Média de démonstration",
    role: "PHOTOGRAPHER",
    pressCardNumber: "CP-DEMO-001",
    requestedZones: ["PRESS_BOX", "PITCHSIDE", "MIXED_ZONE"],
    grantedZones: ["PRESS_BOX", "PITCHSIDE"],
    status: "APPROVED",
    decidedAt: new Date(),
    trackingHash: randomBytes(32).toString("hex"),
    badgeToken,
    photoKey,
    photoType: "image/png",
  })
  .returning({ id: accreditations.id, number: accreditations.number });
await db.insert(auditLogs).values({ userId: null, action: "DEMO_SEED", entity: "demo-badge", details: { accreditations: [acc.id] } });
console.log(`Badge ${acc.number} pour ${event.title}`);
console.log(`Badge : /accreditations/badge/${badgeToken}`);
console.log(`Vérification (QR) : /accreditations/badge/${badgeToken}/verifier`);
process.exit(0);
