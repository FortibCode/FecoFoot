import { and, eq, ne } from "drizzle-orm";
import { competitions, matches } from "@/lib/db/schema";
import { matchQuery } from "@/lib/queries/competitions";

/** Échappement d'un texte iCalendar (RFC 5545). */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fichier agenda (.ics) d'un match programmé : date, heure, stade, lien vers la fiche. */
export async function GET(request: Request, ctx: RouteContext<"/matchs/[id]/agenda">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Match introuvable.", { status: 404 });
  const [row] = await matchQuery()
    .where(and(eq(matches.id, id), ne(competitions.status, "DRAFT")))
    .limit(1);
  if (!row?.match.kickoffAt) return new Response("Match introuvable ou sans date.", { status: 404 });
  const { match: m, home, away, competition: c } = row;
  const start = m.kickoffAt!;
  const end = new Date(start.getTime() + 2 * 3_600_000);
  const url = new URL(`/matchs/${m.id}`, process.env.APP_URL ?? request.url).toString();
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FECOFOOT//Matchs//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:match-${m.id}@fecofoot`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${home?.name ?? "À déterminer"} – ${away?.name ?? "À déterminer"}`)}`,
    `DESCRIPTION:${esc(`${c.name}. Fiche du match : ${url}`)}`,
    ...(m.venue ? [`LOCATION:${esc(m.venue)}`] : []),
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="match-${m.id}.ics"`, "Cache-Control": "no-store" },
  });
}
