import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams, selections } from "@/lib/db/schema";
import { finish, header, newDocument, table } from "@/lib/exports/pdf";
import { download, workbook, XLSX_TYPE } from "@/lib/exports/xlsx";
import { formatDate, slugify } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { calledPlayers } from "@/lib/queries/national";

/** Liste officielle des convoqués — Excel ou PDF (EF-SEL-03, EF-EXP-01). */
export async function GET(request: Request, ctx: RouteContext<"/admin/exports/convocation/[id]">) {
  await requirePermission("national_teams.manage");
  const id = Number((await ctx.params).id);
  const [row] = await db
    .select({ s: selections, team: nationalTeams.name })
    .from(selections)
    .innerJoin(nationalTeams, eq(selections.teamId, nationalTeams.id))
    .where(eq(selections.id, id))
    .limit(1);
  if (!row) return new Response("Liste introuvable.", { status: 404 });
  const list = await calledPlayers(id);
  const data = list.map((p) => [p.shirtNumber, p.name, p.position ? POSITION_LABELS[p.position] : "", p.club]);
  const name = `convocation-${slugify(row.team)}-${id}`;

  if (new URL(request.url).searchParams.get("format") === "pdf") {
    const doc = newDocument();
    header(
      doc,
      `${row.team} — liste des joueurs convoqués`,
      [row.s.title, row.s.gatheringDate && `Regroupement le ${formatDate(row.s.gatheringDate)}`, row.s.location].filter(Boolean).join(" · "),
    );
    table(
      doc,
      [
        { header: "N°", width: 35, align: "center" },
        { header: "Joueur", width: 190 },
        { header: "Poste", width: 90 },
        { header: "Club", width: 200 },
      ],
      data,
    );
    return download(await finish(doc), `${name}.pdf`, "application/pdf");
  }
  const xlsx = await workbook("Convoqués", [{ header: "N°", width: 6 }, { header: "Joueur", width: 30 }, { header: "Poste", width: 14 }, { header: "Club", width: 34 }], data);
  return download(xlsx, `${name}.xlsx`, XLSX_TYPE);
}
