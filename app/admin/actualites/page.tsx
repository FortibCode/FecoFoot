import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/articles";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { syncFromOldSite } from "./actions";
import { SyncButton } from "./SyncButton";

export const metadata: Metadata = { title: "Actualités — FECOFOOT" };

export default async function AdminArticlesPage() {
  await requirePermission("communication.manage");
  // Brouillons d'abord, puis du plus récemment publié au plus ancien.
  const rows = await db.select().from(articles).orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.updatedAt} + interval '100 years')`)).limit(500);
  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Actualités et communiqués"
        description={`${rows.length} article(s) · les articles repris de fecofoot.cg se modifient ici comme les autres.`}
        actions={
          <>
            <SyncButton action={syncFromOldSite} />
            <Link href="/admin/actualites/nouveau" className="h-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Nouvel article
            </Link>
          </>
        }
      />
      <DataTable head={["Titre", "Rubrique", "Publication", "Origine", "Modifié le"]}>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/actualites/${a.id}`} className="font-medium underline-offset-2 hover:underline">
                {a.title}
              </Link>
            </td>
            <td className="px-3 py-2">{ARTICLE_CATEGORY_LABELS[a.category]}</td>
            <td className="px-3 py-2">
              <StatusBadge tone={a.status === "PUBLISHED" ? "ok" : "neutral"}>{a.status === "PUBLISHED" ? "Publié" : "Brouillon"}</StatusBadge>
            </td>
            <td className="px-3 py-2 text-xs text-muted-foreground">
              {a.sourceUrl ? (
                <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  fecofoot.cg
                </a>
              ) : (
                "Saisi ici"
              )}
            </td>
            <td className="px-3 py-2">{formatDateTime(a.updatedAt)}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
