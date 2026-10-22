import { API_HEADERS } from "@/lib/public-api";
import { leaguesOverview } from "@/lib/queries/public-leagues";

/** API publique : ligues départementales actives (clubs affiliés, compétitions en cours, saison). */
export async function GET() {
  const rows = await leaguesOverview();
  return Response.json(
    { data: rows.map(({ logoKey, ...l }) => ({ ...l, logo: logoKey ? `/media/ligues/${l.id}` : null })) },
    { headers: API_HEADERS },
  );
}
