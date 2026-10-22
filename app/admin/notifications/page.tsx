import type { Metadata } from "next";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { StatCards } from "@/components/admin/stat-cards";
import { SelectField } from "@/components/ui/field";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { notifyMode } from "@/lib/notify";

export const metadata: Metadata = { title: "Notifications — FECOFOOT" };

/** SMS et e-mails émis par la plateforme (EF-NOT-01, EF-NOT-02). */
export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requirePermission("users.manage");
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const channel = sp.canal === "SMS" || sp.canal === "EMAIL" ? sp.canal : undefined;
  const status = sp.etat === "LOGGED" || sp.etat === "SENT" || sp.etat === "FAILED" ? sp.etat : undefined;
  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(notifications.recipient, `%${q}%`), ilike(notifications.topic, `%${q}%`))!);
  if (channel) filters.push(eq(notifications.channel, channel));
  if (status) filters.push(eq(notifications.status, status));
  const [rows, [counts]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(200),
    db
      .select({
        total: sql<number>`count(*)::int`,
        sms: sql<number>`count(*) filter (where ${notifications.channel} = 'SMS')::int`,
        email: sql<number>`count(*) filter (where ${notifications.channel} = 'EMAIL')::int`,
        failed: sql<number>`count(*) filter (where ${notifications.status} = 'FAILED')::int`,
      })
      .from(notifications),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Notifications"
        description={
          notifyMode() === "log"
            ? "Mode développement : aucun SMS ni e-mail n'est réellement envoyé, les messages sont enregistrés ici."
            : "Messages envoyés (contenu non conservé en production)."
        }
      />
      <StatCards
        stats={[
          { label: "Messages", value: counts.total },
          { label: "SMS", value: counts.sms, href: "/admin/notifications?canal=SMS", active: channel === "SMS" },
          { label: "E-mails", value: counts.email, href: "/admin/notifications?canal=EMAIL", active: channel === "EMAIL" },
          { label: "Échecs d'envoi", value: counts.failed, href: "/admin/notifications?etat=FAILED", active: status === "FAILED" },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Destinataire ou sujet
          <input name="q" defaultValue={q} placeholder="Téléphone, e-mail, sujet" className="admin-input" style={{ maxWidth: 260 }} />
        </label>
        <SelectField label="Canal" name="canal" defaultValue={channel ?? ""}>
          <option value="">Tous</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">E-mail</option>
        </SelectField>
        <SelectField label="État" name="etat" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          <option value="LOGGED">Enregistré (non envoyé)</option>
          <option value="SENT">Envoyé</option>
          <option value="FAILED">Échec</option>
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["Date", "Canal", "Destinataire", "Message", "État"]} pageSize={5}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Aucun message ne correspond.
            </td>
          </tr>
        )}
        {rows.map((n) => (
          <tr key={n.id} className="align-top">
            <td className="whitespace-nowrap px-3 py-2">{formatDateTime(n.createdAt)}</td>
            <td className="px-3 py-2">{n.channel === "SMS" ? "SMS" : "E-mail"}</td>
            <td className="px-3 py-2 font-mono text-xs">{n.recipient}</td>
            <td className="max-w-md whitespace-pre-line break-words px-3 py-2 text-xs">
              {n.subject && <strong className="block">{n.subject}</strong>}
              {n.body}
            </td>
            <td className="px-3 py-2 text-xs">{n.status === "FAILED" ? `Échec : ${n.error}` : n.status === "SENT" ? "Envoyé" : "Enregistré"}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
