import { count, desc, eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { download, workbook, XLSX_TYPE } from "@/lib/exports/xlsx";
import { auditFilters, auditWhere } from "@/lib/queries/audit";

/** Au-delà, l'export est refusé : affiner les filtres (période, action). */
const AUDIT_EXPORT_MAX = 50_000;

/** Export Excel du journal d'audit, avec les filtres de la page (EF-AUD-02). */
export async function GET(request: Request) {
  const user = await requirePermission("audit.read");
  const sp = new URL(request.url).searchParams;
  const filters = auditFilters((k) => sp.get(k));
  const where = auditWhere(filters);

  const [{ total }] = await db.select({ total: count() }).from(auditLogs).where(where);
  if (total > AUDIT_EXPORT_MAX) {
    return new Response(`${total} opérations correspondent : limitez la période (maximum ${AUDIT_EXPORT_MAX}).`, { status: 413 });
  }
  const rows = await db
    .select({ log: auditLogs, user: users.fullName, email: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id));

  // L'export est lui-même une opération sensible tracée.
  await logAudit({ userId: user.id, action: "AUDIT_EXPORTED", entity: "audit_log", details: { ...filters, rows: rows.length } });

  const bytes = await workbook(
    "Journal d'audit",
    [
      { header: "Date (UTC)", width: 20 },
      { header: "Utilisateur", width: 24 },
      { header: "E-mail", width: 28 },
      { header: "Action", width: 26 },
      { header: "Objet", width: 16 },
      { header: "Identifiant", width: 14 },
      { header: "Détails", width: 60 },
      { header: "Adresse IP", width: 18 },
    ],
    rows.map((r) => [
      r.log.createdAt,
      r.user ?? "anonyme",
      r.email ?? "",
      r.log.action,
      r.log.entity,
      r.log.entityId ?? "",
      r.log.details ? JSON.stringify(r.log.details) : "",
      r.log.ip ?? "",
    ]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return download(bytes, `journal-audit-${stamp}.xlsx`, XLSX_TYPE);
}
