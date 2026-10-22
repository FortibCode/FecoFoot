import { requireAnyPermission } from "@/lib/auth/guard";
import { licenseCardPdf } from "@/lib/exports/license-card-pdf";
import { download } from "@/lib/exports/xlsx";
import { cardIssued } from "@/lib/licenses";
import { licenseCardData } from "@/lib/queries/license-card";
import { loadLicenseFor } from "@/lib/queries/players";

/** Carte de licence en PDF (recto et verso) — personnel autorisé dans son périmètre (club, ligue, fédération). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/licences/[id]/carte/pdf">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const id = Number((await ctx.params).id);
  const row = Number.isInteger(id) ? await loadLicenseFor(user, id) : null;
  if (!row || !cardIssued(row.license.status)) return new Response("Carte indisponible.", { status: 404 });
  const data = await licenseCardData(id);
  if (!data) return new Response("Carte indisponible.", { status: 404 });
  return download(await licenseCardPdf(data), `carte-licence-${data.license.number}.pdf`, "application/pdf");
}
