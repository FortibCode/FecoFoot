import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { competitions, matches } from "@/lib/db/schema";
import { API_HEADERS, notFound, publicMatch } from "@/lib/public-api";
import { competitionTables, matchQuery } from "@/lib/queries/competitions";

/** API publique : compétition publiée — calendrier, résultats officiels, classement et buteurs. */
export async function GET(_request: Request, ctx: RouteContext<"/api/competitions/[slug]">) {
  const [c] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.slug, (await ctx.params).slug), ne(competitions.status, "DRAFT")))
    .limit(1);
  if (!c) return notFound();
  const [tables, rows] = await Promise.all([competitionTables(c.id), matchQuery().where(eq(matches.competitionId, c.id)).orderBy(asc(matches.round), asc(matches.kickoffAt))]);
  return Response.json(
    {
      data: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        season: c.season,
        type: c.type,
        category: c.category,
        gender: c.gender,
        status: c.status,
        leagueId: c.leagueId,
        standings: (tables?.tables ?? []).map((t) => ({ zone: t.pool || null, rows: t.rows })),
        scorers: (tables?.scorers ?? []).map((s) => ({ goals: s.goals, player: s.player ? `${s.player.firstName} ${s.player.lastName}` : null, club: s.player?.club ?? null })),
        matches: rows.map(publicMatch),
      },
    },
    { headers: API_HEADERS },
  );
}
