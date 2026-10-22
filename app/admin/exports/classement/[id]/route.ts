import { requirePermission } from "@/lib/auth/guard";
import { finish, header, newDocument, table } from "@/lib/exports/pdf";
import { download, workbook, XLSX_TYPE } from "@/lib/exports/xlsx";
import { seasonLabel } from "@/lib/licenses";
import { competitionFor, competitionTables } from "@/lib/queries/competitions";

/** Classement et meilleurs buteurs d'une compétition — Excel ou PDF (EF-EXP-01). */
export async function GET(request: Request, ctx: RouteContext<"/admin/exports/classement/[id]">) {
  const user = await requirePermission("competitions.manage");
  const id = Number((await ctx.params).id);
  // Périmètre : une ligue n'exporte que les classements de ses compétitions.
  if (!(await competitionFor(user, id))) return new Response("Compétition introuvable.", { status: 404 });
  const data = await competitionTables(id);
  if (!data) return new Response("Compétition introuvable.", { status: 404 });
  const { competition: c, tables, scorers } = data;
  const rows = tables.flatMap((t) =>
    t.rows.map((r, i) => [t.pool || "", i + 1, r.name, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.goalDiff, r.points]),
  );
  const name = `classement-${c.slug}`;

  if (new URL(request.url).searchParams.get("format") === "pdf") {
    const doc = newDocument();
    header(doc, c.name, `Classement — saison ${seasonLabel(c.season)} (résultats validés)`);
    const cols = [
      { header: "Poule", width: 40 },
      { header: "#", width: 25, align: "center" as const },
      { header: "Équipe", width: 170 },
      ...["J", "G", "N", "P", "BP", "BC", "Diff", "Pts"].map((h) => ({ header: h, width: 34, align: "center" as const })),
    ];
    table(doc, cols, rows);
    doc.moveDown(1.5).font("Helvetica-Bold").fontSize(12).text("Meilleurs buteurs");
    doc.moveDown(0.5);
    table(
      doc,
      [
        { header: "#", width: 30, align: "center" },
        { header: "Joueur", width: 220 },
        { header: "Club", width: 180 },
        { header: "Buts", width: 60, align: "center" },
      ],
      scorers.map((s, i) => [i + 1, `${s.player?.firstName ?? ""} ${s.player?.lastName ?? ""}`, s.player?.club ?? "", s.goals]),
    );
    return download(await finish(doc), `${name}.pdf`, "application/pdf");
  }
  const xlsx = await workbook(
    "Classement",
    ["Poule", "Rang", "Équipe", "J", "G", "N", "P", "BP", "BC", "Diff", "Pts"].map((h) => ({ header: h, width: h === "Équipe" ? 30 : 8 })),
    rows,
  );
  return download(xlsx, `${name}.xlsx`, XLSX_TYPE);
}
