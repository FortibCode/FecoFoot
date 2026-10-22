import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { and, asc, count, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { memberships, supporters } from "@/lib/db/schema";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { formatDate } from "@/lib/format";
import { formatCongoPhone, normalizeCongoPhone } from "@/lib/supporters";

export const metadata: Metadata = { title: "Supporters — FECOFOOT" };

/** Fan ID : recherche, interdictions de stade (M11). */
export default async function AdminSupportersPage({ searchParams }: PageProps<"/admin/supporters">) {
  await requirePermission("ticketing.manage");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const phone = q ? normalizeCongoPhone(q) : null;
  const season = seasonOf();
  const [[{ all }], [{ verified }], [{ banned }], [{ members }]] = await Promise.all([
    db.select({ all: count() }).from(supporters),
    db.select({ verified: count() }).from(supporters).where(isNotNull(supporters.idVerifiedAt)),
    db.select({ banned: count() }).from(supporters).where(eq(supporters.banned, true)),
    db.select({ members: count() }).from(memberships).where(and(eq(memberships.season, season), eq(memberships.status, "ACTIVE"))),
  ]);
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
          <Link href="/admin/supporters/adhesions" className="admin-btn admin-btn-outline">
            Tarifs d&apos;adhésion
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: "Fan ID", value: all },
          { label: `Membres ${seasonLabel(season)}`, value: members, sub: "adhésion active" },
          { label: "Pièce vérifiée", value: verified, sub: all ? `${Math.round((verified / all) * 100)} % des Fan ID` : undefined },
          { label: "Interdits de stade", value: banned },
        ]}
      />
      <form className="mb-4 flex items-end gap-2 text-sm">
        <label className="flex flex-col gap-1.5 font-medium">
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, Fan ID, téléphone, n° de pièce" className="h-10 w-72 max-w-full rounded-md border px-3" />
        </label>
        <button type="submit" className="admin-btn admin-btn-outline">
          Rechercher
        </button>
      </form>
      <DataTable head={["Fan ID", "Supporter", "Téléphone", "Inscrit le", "État", ""]} pageSize={5}>
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
            <td>
              <RowActions name={`${s.lastName} ${s.firstName}`} viewHref={`/admin/supporters/${s.id}`} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
