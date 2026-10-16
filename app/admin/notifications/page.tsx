import type { Metadata } from "next";
import { desc, ilike } from "drizzle-orm";
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
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const rows = await db
    .select()
    .from(notifications)
    .where(q ? ilike(notifications.recipient, `%${q}%`) : undefined)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(100);

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
      <form className="mb-4 flex items-end gap-2 text-sm">
        <label className="flex flex-col gap-1.5 font-medium">
          Destinataire
          <input name="q" defaultValue={q} placeholder="Téléphone ou e-mail" className="h-10 rounded-md border px-3" />
        </label>
        <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
          Filtrer
        </button>
      </form>
      <DataTable head={["Date", "Canal", "Destinataire", "Message", "État"]}>
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
