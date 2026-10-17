import { requirePermission } from "@/lib/auth/guard";
import type { OfflineList } from "@/lib/offline-control";
import { offlineTicketList } from "@/lib/ticket-sales";

/** Liste des billets d'un match pour le contrôle hors ligne (EF-CTL-06) — empreintes uniquement. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/billetterie/controle/[id]/liste">) {
  await requirePermission("ticketing.manage");
  const eventId = Number((await ctx.params).id);
  if (!Number.isInteger(eventId)) return new Response("Match invalide.", { status: 400 });
  const body: OfflineList = { eventId, downloadedAt: new Date().toISOString(), tickets: await offlineTicketList(eventId) };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
