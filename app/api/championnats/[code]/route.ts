import { asc, eq } from "drizzle-orm";
import { matches } from "@/lib/db/schema";
import { API_HEADERS, notFound, publicMatch } from "@/lib/public-api";
import { championshipByCode, championshipSeason, seasonTeams } from "@/lib/queries/championships";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

/**
 * API publique : saison d'un championnat national (?saison=2026, ?zone=A) — clubs, calendrier,
 * résultats officiels et classement par zone.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/championnats/[code]">) {
  const ch = await championshipByCode((await ctx.params).code);
  if (!ch?.active) return notFound();
  const url = new URL(request.url);
  const { editions, current } = await championshipSeason(ch.id, Number(url.searchParams.get("saison")) || undefined);
  if (!current) return Response.json({ data: { code: ch.code, name: ch.name, seasons: [], season: null } }, { headers: API_HEADERS });
  const zone = url.searchParams.get("zone")?.toUpperCase() || null;
  const [tables, rows, teams] = await Promise.all([
    competitionTables(current.id),
    matchQuery().where(eq(matches.competitionId, current.id)).orderBy(asc(matches.round), asc(matches.kickoffAt)),
    seasonTeams(current.id),
  ]);
  return Response.json(
    {
      data: {
        code: ch.code,
        name: ch.name,
        seasons: editions.map((e) => e.season),
        season: {
          season: current.season,
          name: current.name,
          status: current.status,
          promotionSpots: current.promotionSpots,
          relegationSpots: current.relegationSpots,
          clubs: teams.filter((t) => !zone || t.pool === zone).map(({ registeredAt, ...t }) => ({ ...t, zone: t.pool, registeredAt })),
          standings: (tables?.tables ?? []).filter((t) => !zone || t.pool === zone).map((t) => ({ zone: t.pool || null, rows: t.rows })),
          matches: rows.filter((r) => !zone || r.match.pool === zone).map(publicMatch),
        },
      },
    },
    { headers: API_HEADERS },
  );
}
