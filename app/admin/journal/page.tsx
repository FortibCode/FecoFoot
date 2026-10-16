import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit — FECOFOOT" };

const PAGE_SIZE = 50;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function AuditPage({ searchParams }: PageProps<"/admin/journal">) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const action = one(sp.action);
  const entity = one(sp.entity);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const filters: SQL[] = [];
  if (action) filters.push(eq(auditLogs.action, action));
  if (entity) filters.push(eq(auditLogs.entity, entity));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        ip: auditLogs.ip,
        user: users.fullName,
        email: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (entity) q.set("entity", entity);
    q.set("page", String(p));
    return `/admin/journal?${q}`;
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Journal d'audit" description={`${total} opération(s) enregistrée(s)`} />

      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          Action
          <input name="action" defaultValue={action} placeholder="ex. LOGIN_FAILED" className="h-9 rounded-md border px-2" />
        </label>
        <label className="flex flex-col gap-1">
          Objet
          <input name="entity" defaultValue={entity} placeholder="ex. user, club" className="h-9 rounded-md border px-2" />
        </label>
        <button type="submit" className="h-9 rounded-md border px-3 hover:bg-muted">
          Filtrer
        </button>
      </form>

      <DataTable head={["Date", "Utilisateur", "Action", "Objet", "Détails", "IP"]}>
        {rows.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="whitespace-nowrap px-3 py-2">{formatDateTime(r.createdAt)}</td>
            <td className="px-3 py-2">{r.user ?? <span className="text-muted-foreground">anonyme</span>}</td>
            <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
            <td className="px-3 py-2 font-mono text-xs">
              {r.entity}
              {r.entityId && ` #${r.entityId}`}
            </td>
            <td className="max-w-xs break-words px-3 py-2 font-mono text-xs text-muted-foreground">
              {r.details ? JSON.stringify(r.details) : ""}
            </td>
            <td className="px-3 py-2 font-mono text-xs">{r.ip ?? ""}</td>
          </tr>
        ))}
      </DataTable>

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={pageHref(page - 1)} className="underline">← Précédent</Link>}
          <span>
            Page {page} / {pages}
          </span>
          {page < pages && <Link href={pageHref(page + 1)} className="underline">Suivant →</Link>}
        </nav>
      )}
    </>
  );
}
