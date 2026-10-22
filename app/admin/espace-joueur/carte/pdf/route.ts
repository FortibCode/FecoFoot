import { and, desc, eq, inArray } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { licenses, players } from "@/lib/db/schema";
import { licenseCardPdf } from "@/lib/exports/license-card-pdf";
import { download } from "@/lib/exports/xlsx";
import { licenseCardData } from "@/lib/queries/license-card";

/** Le joueur télécharge sa propre carte (dernière licence délivrée) ; jamais celle d'un autre joueur. */
export async function GET() {
  const user = await requirePermission("player.self");
  const [lic] = await db
    .select({ id: licenses.id })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .where(and(eq(players.userId, user.id), inArray(licenses.status, ["VALIDATED", "SUSPENDED", "REVOKED", "EXPIRED"])))
    .orderBy(desc(licenses.season), desc(licenses.id))
    .limit(1);
  const data = lic ? await licenseCardData(lic.id) : null;
  if (!data) return new Response("Aucune carte délivrée.", { status: 404 });
  return download(await licenseCardPdf(data), `carte-licence-${data.license.number}.pdf`, "application/pdf");
}
