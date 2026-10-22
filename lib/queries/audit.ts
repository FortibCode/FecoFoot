import "server-only";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";

export type AuditFilters = { action?: string; entity?: string; from?: string; to?: string };

const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

/** Filtres du journal (page et export partagent la même lecture des paramètres). */
export function auditFilters(get: (key: string) => string | string[] | null | undefined): AuditFilters {
  return { action: one(get("action")), entity: one(get("entity")), from: isDay(one(get("from"))), to: isDay(one(get("to"))) };
}

/** Bornes de dates en jours entiers à l'heure de Brazzaville (UTC+1), « au » inclus. */
export function auditWhere(f: AuditFilters): SQL | undefined {
  const filters: SQL[] = [];
  if (f.action) filters.push(eq(auditLogs.action, f.action));
  if (f.entity) filters.push(eq(auditLogs.entity, f.entity));
  if (f.from) filters.push(gte(auditLogs.createdAt, new Date(`${f.from}T00:00:00+01:00`)));
  if (f.to) filters.push(lt(auditLogs.createdAt, new Date(new Date(`${f.to}T00:00:00+01:00`).getTime() + 86_400_000)));
  return filters.length ? and(...filters) : undefined;
}

export function auditQueryString(f: AuditFilters): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  return q;
}

/** Historique des opérations sur un objet (feuille de match, compétition, ligue), du plus récent au plus ancien. */
export async function entityHistory(entity: string, entityId: number, limit = 30) {
  return db
    .select({ id: auditLogs.id, action: auditLogs.action, details: auditLogs.details, createdAt: auditLogs.createdAt, user: users.fullName })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.entity, entity), eq(auditLogs.entityId, String(entityId))))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
}
