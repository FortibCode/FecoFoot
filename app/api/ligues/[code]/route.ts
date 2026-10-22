import { API_HEADERS, notFound, publicMatch } from "@/lib/public-api";
import { leagueDetail } from "@/lib/queries/public-leagues";

/** API publique : fiche d'une ligue (clubs affiliés, compétitions publiées, matchs à venir, résultats officiels). */
export async function GET(_request: Request, ctx: RouteContext<"/api/ligues/[code]">) {
  const data = await leagueDetail((await ctx.params).code);
  if (!data) return notFound();
  const { league: l } = data;
  return Response.json(
    {
      data: {
        id: l.id,
        code: l.code,
        name: l.name,
        department: l.department,
        description: l.description,
        president: l.president,
        clubs: data.clubs,
        competitions: data.competitions.map((c) => ({ id: c.id, name: c.name, slug: c.slug, season: c.season, category: c.category, gender: c.gender, type: c.type, status: c.status })),
        upcoming: data.upcoming.map(publicMatch),
        results: data.results.map(publicMatch),
      },
    },
    { headers: API_HEADERS },
  );
}
