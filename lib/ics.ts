/** Fichier agenda (iCalendar, RFC 5545) d'une rencontre : date, durée de 2 h, lieu et lien vers sa fiche. */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function matchCalendar(e: { uid: string; start: Date; summary: string; description: string; location: string | null; url: string }, now: Date = new Date()): string {
  const end = new Date(e.start.getTime() + 2 * 3_600_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FECOFOOT//Matchs//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.uid}@fecofoot`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.summary)}`,
    `DESCRIPTION:${esc(e.description)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export const calendarResponse = (ics: string, filename: string) =>
  new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
