import { and, eq, ne } from "drizzle-orm";
import { competitions, matches } from "@/lib/db/schema";
import { calendarResponse, matchCalendar } from "@/lib/ics";
import { matchQuery } from "@/lib/queries/competitions";

/** Fichier agenda (.ics) d'un match de club programmé : date, heure, stade, lien vers la fiche. */
export async function GET(request: Request, ctx: RouteContext<"/matchs/[id]/agenda">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Match introuvable.", { status: 404 });
  const [row] = await matchQuery()
    .where(and(eq(matches.id, id), ne(competitions.status, "DRAFT")))
    .limit(1);
  if (!row?.match.kickoffAt) return new Response("Match introuvable ou sans date.", { status: 404 });
  const { match: m, home, away, competition: c } = row;
  const url = new URL(`/matchs/${m.id}`, process.env.APP_URL ?? request.url).toString();
  const ics = matchCalendar({
    uid: `match-${m.id}`,
    start: m.kickoffAt!,
    summary: `${home?.name ?? "À déterminer"} – ${away?.name ?? "À déterminer"}`,
    description: `${c.name}. Fiche du match : ${url}`,
    location: m.venue,
    url,
  });
  return calendarResponse(ics, `match-${m.id}.ics`);
}
