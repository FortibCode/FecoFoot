import { requireSupporter } from "@/lib/auth/fan-session";
import { ticketsPdf } from "@/lib/exports/ticket-pdf";
import { download } from "@/lib/exports/xlsx";
import { appUrl } from "@/lib/qr";
import { supporterTickets } from "@/lib/queries/fan-tickets";

/** Billet à imprimer (PDF A4), téléchargeable par son seul acheteur. */
export async function GET(_request: Request, ctx: RouteContext<"/billet/[token]/pdf">) {
  const s = await requireSupporter();
  const { token } = await ctx.params;
  const [t] = /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await supporterTickets(s.id, token) : [];
  if (!t) return new Response("Introuvable", { status: 404 });
  const pdf = await ticketsPdf([{ ...t, qrUrl: await appUrl(`/billet/${t.token}`) }]);
  return download(pdf, `billet-${t.number}.pdf`, "application/pdf");
}
