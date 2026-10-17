import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, ilike, or } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { supporters } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { formatCongoPhone, normalizeCongoPhone } from "@/lib/supporters";

export const metadata: Metadata = { title: "Supporters — FECOFOOT" };

/** Fan ID : recherche, interdictions de stade (M11). */
export default async function AdminSupportersPage({ searchParams }: PageProps<"/admin/supporters">) {
  await requirePermission("ticketing.manage");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const phone = q ? normalizeCongoPhone(q) : null;
  const rows = await db
    .select()
    .from(supporters)
    .where(
      q
        ? or(ilike(supporters.lastName, `%${q}%`), ilike(supporters.firstName, `%${q}%`), ilike(supporters.fanId, `%${q}%`), ilike(supporters.idDocumentNumber, `%${q}%`), ...(phone ? [ilike(supporters.phone, phone)] : []))
        : undefined,
    )
    .orderBy(desc(supporters.banned), asc(supporters.lastName))
    .limit(100);

  return (
    <>
      <PageHeader
        eyebrow="Stade & supporters"
        title="Supporters (Fan ID)"
        actions={
          <Link href="/admin/supporters/adhesions" className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Tarifs d&apos;adhésion
          </Link>
        }
      />
      <form className="mb-4 flex items-end gap-2 text-sm">
        <label className="flex flex-col gap-1.5 font-medium">
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, Fan ID, téléphone, n° de pièce" className="h-10 w-72 max-w-full rounded-md border px-3" />
        </label>
        <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
          Rechercher
        </button>
      </form>
      <DataTable head={["Fan ID", "Supporter", "Téléphone", "Inscrit le", "État"]}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td className="px-3 py-2 font-mono text-xs">{s.fanId}</td>
            <td className="px-3 py-2">
              <Link href={`/admin/supporters/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                {s.lastName} {s.firstName}
              </Link>
            </td>
            <td className="px-3 py-2">{formatCongoPhone(s.phone)}</td>
            <td className="px-3 py-2">{formatDate(s.createdAt)}</td>
            <td className="px-3 py-2">{s.banned ? <span className="text-destructive">Interdit de stade</span> : "Actif"}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
