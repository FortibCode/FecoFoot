import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * Limitation des requêtes (ENF-13) — fenêtre fixe, compteur partagé en base :
 * fonctionne avec plusieurs instances, sans service supplémentaire.
 * L'incrément est atomique (INSERT … ON CONFLICT DO UPDATE).
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const windowSec = Math.ceil(windowMs / 1000);
  const [row] = await db.execute<{ count: number; window_start: string }>(sql`
    insert into ${rateLimits} (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) then 1 else ${rateLimits.count} + 1 end,
      window_start = case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) then now() else ${rateLimits.windowStart} end
    returning count, window_start`);

  // Ménage occasionnel des compteurs expirés.
  if (Math.random() < 0.01) await db.execute(sql`delete from ${rateLimits} where ${rateLimits.windowStart} < now() - interval '1 day'`);

  const elapsed = Date.now() - new Date(row.window_start).getTime();
  return { allowed: Number(row.count) <= limit, retryAfterSec: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)) };
}

/** Règles de limitation par formulaire public. */
export const LIMITS = {
  loginFailuresPerIp: { limit: 30, windowMs: 15 * 60_000 },
  passwordResetPerIp: { limit: 10, windowMs: 60 * 60_000 },
  passwordResetPerEmail: { limit: 3, windowMs: 60 * 60_000 },
  consentAnswerPerIp: { limit: 30, windowMs: 15 * 60_000 },
  licenseVerifyPerIp: { limit: 120, windowMs: 60_000 },
} as const;

export const retryMessage = (sec: number) =>
  `Trop de tentatives. Réessayez dans ${sec < 90 ? `${sec} secondes` : `${Math.ceil(sec / 60)} minutes`}.`;

/** Consulte un compteur sans l'incrémenter (ex. : ne compter que les échecs de connexion). */
export async function peekRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const [row] = await db
    .select({ count: rateLimits.count, windowStart: rateLimits.windowStart })
    .from(rateLimits)
    .where(sql`${rateLimits.key} = ${key} and ${rateLimits.windowStart} >= now() - make_interval(secs => ${Math.ceil(windowMs / 1000)})`);
  if (!row) return { allowed: true, retryAfterSec: 0 };
  const elapsed = Date.now() - row.windowStart.getTime();
  return { allowed: row.count < limit, retryAfterSec: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)) };
}
