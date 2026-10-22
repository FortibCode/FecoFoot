import { timingSafeEqual } from "node:crypto";
import { syncAllLinked } from "@/lib/live-sync";

/**
 * Synchronisation planifiée des compétitions liées à une source externe (scores en direct, calendriers).
 * Appelée par le planificateur du serveur (cron) : POST avec « Authorization: Bearer <SYNC_SECRET> ».
 * Sans SYNC_SECRET configuré, la route est fermée.
 */
export async function POST(request: Request) {
  const secret = process.env.SYNC_SECRET?.trim();
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok = Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const results = await syncAllLinked("cron");
  return Response.json({ results: results.map(({ runId, created, updated, conflicts, skipped, error }) => ({ runId, created, updated, conflicts, skipped, error })) }, { headers: { "Cache-Control": "no-store" } });
}
