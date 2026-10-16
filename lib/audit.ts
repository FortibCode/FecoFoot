import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { clientIp } from "@/lib/request";

/** Journal d'audit des opérations sensibles — EF-AUD-01. */
export async function logAudit(entry: {
  userId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const ip = await clientIp();
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId == null ? null : String(entry.entityId),
    details: entry.details ?? null,
    ip,
  });
}
