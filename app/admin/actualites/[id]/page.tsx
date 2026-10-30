import type { Metadata } from "next";
import { nationalTeams } from "@/lib/db/schema";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { UploadForm } from "@/components/admin/upload-form";
import { coverUrl, renderRichText } from "@/lib/articles";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { setArticlePublished, updateArticle, uploadCover } from "../actions";
import { ArticleForm } from "../ArticleForm";

export const metadata: Metadata = { title: "Article — FECOFOOT" };

export default async function AdminArticlePage({ params }: PageProps<"/admin/actualites/[id]">) {
  await requirePermission("communication.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [a] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!a) notFound();
  const published = a.status === "PUBLISHED";
  const cover = coverUrl(a);

  return (
    <>
      <PageHeader
        eyebrow={`Communication · ${published ? `publié le ${formatDateTime(a.publishedAt)}` : "brouillon"}`}
        title={a.title}
        actions={
          published && (
            <Link href={`/actualites/${a.slug}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Voir sur le portail
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-10">
        <ActionForm action={setArticlePublished.bind(null, id, !published)} label={published ? "Retirer du portail" : "Publier"} variant={published ? "outline" : "default"} />

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Visuel de couverture</h2>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- visuel servi par la route des médias
            <img src={cover} alt="" className="aspect-video w-full max-w-md rounded-lg border object-cover" />
          ) : (
            <EmptyState icon="photo" title="Aucun visuel" compact />
          )}
          <UploadForm action={uploadCover.bind(null, id)} accept="image/jpeg,image/png,image/webp" label={cover ? "Remplacer" : "Ajouter"} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Contenu</h2>
          <div id="modifier">
          <ArticleForm teams={await db.select({ id: nationalTeams.id, name: nationalTeams.name }).from(nationalTeams).orderBy(nationalTeams.id)} action={updateArticle.bind(null, id)} initial={a} submitLabel="Enregistrer" />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Aperçu</h2>
          <div className="article-body max-w-3xl rounded-lg border p-4" dangerouslySetInnerHTML={{ __html: renderRichText(a.body) }} />
        </section>
      </div>
    </>
  );
}
