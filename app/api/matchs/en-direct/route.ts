import { and, asc, inArray, ne } from "drizzle-orm";
import { competitions, matches } from "@/lib/db/schema";
import { publicMatch } from "@/lib/public-api";
import { matchQuery } from "@/lib/queries/competitions";

/** API publique : matchs en cours (saisie officielle de la feuille de match), toutes compétitions publiées. */
export async function GET() {
  const rows = await matchQuery()
    .where(and(inArray(matches.status, ["LIVE", "HALF_TIME"]), ne(competitions.status, "DRAFT")))
    .orderBy(asc(matches.kickoffAt))
    .limit(100);
  return Response.json({ data: rows.map(publicMatch) }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
