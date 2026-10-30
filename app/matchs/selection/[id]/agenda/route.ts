import { calendarResponse, matchCalendar } from "@/lib/ics";
import { nationalFixture } from "@/lib/queries/national";

/** Fichier agenda (.ics) d'un match des sélections. */
export async function GET(request: Request, ctx: RouteContext<"/matchs/selection/[id]/agenda">) {
  const row = await nationalFixture(Number((await ctx.params).id));
  if (!row) return new Response("Match introuvable.", { status: 404 });
  const [home, away] = row.sides;
  const url = new URL(`/matchs/selection/${row.f.id}`, process.env.APP_URL ?? request.url).toString();
  const ics = matchCalendar({
    uid: `selection-${row.f.id}`,
    start: row.f.kickoffAt,
    summary: `${home.name} – ${away.name} (${row.team.name})`,
    description: `${[row.team.name, row.f.competition].filter(Boolean).join(" · ")}. Fiche du match : ${url}`,
    location: row.f.venue,
    url,
  });
  return calendarResponse(ics, `match-selection-${row.f.id}.ics`);
}
