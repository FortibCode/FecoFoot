import { requireSupporter } from "@/lib/auth/fan-session";
import { ticketsPdf } from "@/lib/exports/ticket-pdf";
import { download } from "@/lib/exports/xlsx";
import { appUrl } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";

/** Tous les billets valables du supporter, un par page (PDF A4 à imprimer). */
export async function GET() {
  const s = await requireSupporter();
  const list = (await supporterTickets(s.id)).filter((t) => t.status === "VALID");
  if (list.length === 0) return new Response("Aucun billet valable.", { status: 404 });
  const pdf = await ticketsPdf(await Promise.all(list.map(async (t) => ({ ...t, qrUrl: await appUrl(`/billet/${t.token}`) }))));
  return download(pdf, `billets-fecofoot-${s.fanId}.pdf`, "application/pdf");
}
