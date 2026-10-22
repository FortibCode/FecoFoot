import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { deleteArticle } from "./actions";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS } from "@/lib/articles";
import { StatCards } from "@/components/admin/stat-cards";
import { SelectField } from "@/components/ui/field";
import { textMatch } from "@/lib/text-search";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { syncFromOldSite } from "./actions";
import { SyncButton } from "./SyncButton";

export const metadata: Metadata = { title: "Actualités — FECOFOOT" };

export default async function AdminArticlesPage({ searchParams }: PageProps<"/admin/actualites">) {
  await requirePermission("communication.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const category = ARTICLE_CATEGORIES.find((c) => c === sp.category);
  const status = sp.status === "PUBLISHED" || sp.status === "DRAFT" ? sp.status : undefined;
  const origin = sp.origin === "import" || sp.origin === "local" ? sp.origin : undefined;
  // Brouillons d'abord, puis du plus récemment publié au plus ancien.
  const all = await db.select().from(articles).orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.updatedAt} + interval '100 years')`)).limit(1000);
  const rows = all.filter(
    (a) =>
      textMatch(q, a.title, a.summary) &&
      (!category || a.category === category) &&
      (!status || a.status === status) &&
      (!origin || (origin === "import") === Boolean(a.sourceUrl)),
  );
  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title="Actualités et communiqués"
        description={`${all.length} article(s) · les articles repris de fecofoot.cg se modifient ici comme les autres.`}
        actions={
          <>
            <SyncButton action={syncFromOldSite} />
            <Link href="/admin/actualites/nouveau" className="admin-btn admin-btn-primary">
              Nouvel article
            </Link>
          </>
        }
      />
      <StatCards
        stats={[
          { label: "Publiés", value: all.filter((a) => a.status === "PUBLISHED").length, href: "/admin/actualites?status=PUBLISHED", active: status === "PUBLISHED" },
          { label: "Brouillons", value: all.filter((a) => a.status === "DRAFT").length, href: "/admin/actualites?status=DRAFT", active: status === "DRAFT" },
          { label: "Repris de fecofoot.cg", value: all.filter((a) => a.sourceUrl).length, href: "/admin/actualites?origin=import", active: origin === "import" },
          { label: "Rédigés ici", value: all.filter((a) => !a.sourceUrl).length, href: "/admin/actualites?origin=local", active: origin === "local" },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Titre ou résumé" className="admin-input" style={{ maxWidth: 240 }} />
        </label>
        <SelectField label="Rubrique" name="category" defaultValue={category ?? ""}>
          <option value="">Toutes</option>
          {ARTICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ARTICLE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Publication" name="status" defaultValue={status ?? ""}>
          <option value="">Toutes</option>
          <option value="PUBLISHED">Publiés</option>
          <option value="DRAFT">Brouillons</option>
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["Titre", "Rubrique", "Publication", "Origine", "Modifié le", ""]} pageSize={5}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-muted-foreground">
              Aucun article ne correspond.
            </td>
          </tr>
        )}
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
            <td>
              <RowActions name={a.title} viewHref={`/admin/actualites/${a.id}`} editHref={`/admin/actualites/${a.id}#modifier`} onDelete={deleteArticle.bind(null, a.id)} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
