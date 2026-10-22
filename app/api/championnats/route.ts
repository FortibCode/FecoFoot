import { API_HEADERS } from "@/lib/public-api";
import { championshipsWithSeasons } from "@/lib/queries/championships";

/** API publique : championnats nationaux (Ligue 1, Ligue 2) et leurs saisons. */
export async function GET() {
  const list = await championshipsWithSeasons({ published: false });
  return Response.json(
    {
      data: list
        .filter((ch) => ch.active)
        .map((ch) => ({
          code: ch.code,
          name: ch.name,
          tier: ch.tier,
          seasons: ch.seasons.map(({ c, teams }) => ({ season: c.season, name: c.name, status: c.status, clubs: teams, slug: c.slug })),
        })),
    },
    { headers: API_HEADERS },
  );
}
