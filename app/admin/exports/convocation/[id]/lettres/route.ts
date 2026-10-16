import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams, selections } from "@/lib/db/schema";
import { finish, header, newDocument, table } from "@/lib/exports/pdf";
import { download } from "@/lib/exports/xlsx";
import { formatDate, slugify } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { calledPlayers } from "@/lib/queries/national";

/** Lettres de convocation aux clubs : une page par club national concerné (EF-SEL-05). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/exports/convocation/[id]/lettres">) {
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
  const byClub = new Map<number, { name: string; players: typeof list }>();
  for (const p of list) {
    if (!p.homeClub) continue; // joueurs de l'étranger : convocation par leur club étranger, hors plateforme
    const entry = byClub.get(p.homeClub.id) ?? { name: p.homeClub.name, players: [] };
    entry.players.push(p);
    byClub.set(p.homeClub.id, entry);
  }
  if (byClub.size === 0) return new Response("Aucun joueur d'un club national dans cette liste.", { status: 404 });

  const doc = newDocument();
  [...byClub.values()].forEach((club, i) => {
    if (i > 0) doc.addPage();
    header(doc, "Lettre de convocation", `${row.team} — ${row.s.title}`);
    doc.font("Helvetica").fontSize(10).text(`À l'attention du président du club ${club.name},`);
    doc.moveDown();
    const when = [row.s.gatheringDate && `le ${formatDate(row.s.gatheringDate)}`, row.s.location && `à ${row.s.location}`].filter(Boolean).join(" ");
    doc.text(
      `La Direction technique nationale a l'honneur de vous informer que le(s) joueur(s) ci-dessous, licencié(s) dans votre club, ` +
        `est (sont) convoqué(s) en sélection nationale (${row.team})${when ? `, regroupement ${when}` : ""}. ` +
        `Nous vous remercions de bien vouloir prendre toutes les dispositions pour leur mise à disposition.`,
      { align: "justify" },
    );
    if (row.s.purpose) doc.moveDown().text(`Objet : ${row.s.purpose}`);
    doc.moveDown();
    table(
      doc,
      [
        { header: "Joueur", width: 260 },
        { header: "Identifiant fédéral", width: 140 },
        { header: "Poste", width: 110 },
      ],
      club.players.map((p) => [p.name, p.federalId ?? "", p.position ? POSITION_LABELS[p.position] : ""]),
    );
    doc.moveDown(2).font("Helvetica-Bold").text("La Direction technique nationale", { align: "right" });
  });
  return download(await finish(doc), `lettres-convocation-${slugify(row.team)}-${id}.pdf`, "application/pdf");
}
