import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Point de contrôle de santé (ENF-07) : utilisé par Docker et par l'outil de supervision.
 * 200 si l'application et la base répondent, 503 sinon. Aucune donnée sensible.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unreachable", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
