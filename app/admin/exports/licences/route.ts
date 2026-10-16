import { and, asc, eq } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, licenses, players } from "@/lib/db/schema";
import { finish, header, newDocument, table } from "@/lib/exports/pdf";
import { download, workbook, XLSX_TYPE } from "@/lib/exports/xlsx";
import { formatDate, formatFcfa, slugify } from "@/lib/format";
import { CATEGORY_LABELS, effectiveStatus, LICENSE_STATUS_LABELS, seasonLabel, seasonOf } from "@/lib/licenses";
import { loadClubFor } from "@/lib/queries/players";

/** Licences d'un club pour une saison — Excel ou PDF (EF-EXP-01). */
export async function GET(request: Request) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const url = new URL(request.url);
  const clubId = user.role === "CLUB" ? user.clubId : Number(url.searchParams.get("club"));
  const season = Number(url.searchParams.get("season")) || seasonOf();
  const club = clubId ? await loadClubFor(user, clubId) : null;
  if (!club) return new Response("Club introuvable ou hors de votre périmètre.", { status: 404 });

  const rows = await db
    .select({ l: licenses, lastName: players.lastName, firstName: players.firstName, federalId: players.federalId, birthDate: players.birthDate })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .innerJoin(clubs, eq(licenses.clubId, clubs.id))
    .where(and(eq(licenses.clubId, club.id), eq(licenses.season, season)))
    .orderBy(asc(players.lastName), asc(players.firstName));
  const data = rows.map((r) => [
    r.l.number,
    `${r.lastName} ${r.firstName}`,
    r.federalId,
    formatDate(r.birthDate),
    CATEGORY_LABELS[r.l.category],
    LICENSE_STATUS_LABELS[effectiveStatus(r.l.status, r.l.expiresAt)],
    formatFcfa(r.l.feeAmount),
  ]);
  const name = `licences-${slugify(club.name)}-${season}`;

  if (url.searchParams.get("format") === "pdf") {
    const doc = newDocument({ landscape: true });
    header(doc, `Licences ${seasonLabel(season)} — ${club.name}`, `${club.affiliationNumber} · ${rows.length} licence(s)`);
    table(
      doc,
      [
        { header: "N° licence", width: 100 },
        { header: "Joueur", width: 180 },
        { header: "Identifiant", width: 110 },
        { header: "Naissance", width: 70 },
        { header: "Catégorie", width: 120 },
        { header: "Statut", width: 100 },
        { header: "Droits", width: 80, align: "right" },
      ],
      data,
    );
    return download(await finish(doc), `${name}.pdf`, "application/pdf");
  }
  const xlsx = await workbook(
    "Licences",
    [{ header: "N° licence", width: 18 }, { header: "Joueur", width: 30 }, { header: "Identifiant", width: 20 }, { header: "Naissance" }, { header: "Catégorie", width: 24 }, { header: "Statut", width: 18 }, { header: "Droits (FCFA)", width: 14 }],
    rows.map((r, i) => [...data[i].slice(0, 6), r.l.feeAmount]),
  );
  return download(xlsx, `${name}.xlsx`, XLSX_TYPE);
}
