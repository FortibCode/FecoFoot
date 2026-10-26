import { pressBadgePdf } from "@/lib/exports/press-badge-pdf";
import { download } from "@/lib/exports/xlsx";
import { appUrl } from "@/lib/qr";
import { accreditationByBadge } from "@/lib/queries/accreditations";
import { getFileOrNull } from "@/lib/storage";

/** Badge presse en PDF (format A6), pour une accréditation approuvée. */
export async function GET(_request: Request, ctx: RouteContext<"/accreditations/badge/[token]/pdf">) {
  const { token } = await ctx.params;
  const row = await accreditationByBadge(token);
  if (!row || row.acc.status !== "APPROVED") return new Response("Introuvable", { status: 404 });
  const { acc, event } = row;
  const photo = acc.photoKey && /^image\/(jpeg|png)$/.test(acc.photoType ?? "") ? await getFileOrNull(acc.photoKey) : null;
  const pdf = await pressBadgePdf({
    ...acc,
    grantedZones: acc.grantedZones ?? [],
    event: event.title,
    kickoffAt: event.kickoffAt,
    venue: event.venue,
    qrUrl: await appUrl(`/accreditations/badge/${token}/verifier`),
    photo: photo ? Buffer.from(photo) : null,
  });
  return download(pdf, `badge-presse-${acc.number}.pdf`, "application/pdf");
}
