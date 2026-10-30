"use server";

import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { ARTICLE_CATEGORIES } from "@/lib/articles";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { deleteArticleRecord } from "@/lib/deletion";
import { articles } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { slugify } from "@/lib/format";
import { syncNews } from "@/lib/news-sync";
import { deleteFile, putFile } from "@/lib/storage";

const ArticleSchema = z.object({
  title: z.string().trim().min(5, { error: "Titre requis (5 caractères minimum)." }).max(200),
  summary: z.string().trim().min(10, { error: "Chapô requis." }).max(400),
  body: z.string().trim().min(20, { error: "Texte de l'article requis." }).max(50_000),
  category: z.enum(ARTICLE_CATEGORIES, { error: "Rubrique requise." }),
  nationalTeamId: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable()),
});

const revalidatePublic = () => {
  revalidatePath("/actualites", "layout");
  revalidatePath("/equipes-nationales", "layout");
  revalidatePath("/");
};

/** Rédaction d'un article (EF-COM-01) : créé en brouillon. */
export async function createArticle(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const parsed = ArticleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const base = slugify(parsed.data.title).slice(0, 180) || "article";
  const taken = new Set((await db.select({ slug: articles.slug }).from(articles).where(like(articles.slug, `${base}%`))).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const [created] = await db.insert(articles).values({ ...parsed.data, slug, authorId: user.id }).returning({ id: articles.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "article", entityId: created.id, details: { title: parsed.data.title } });
  redirect(`/admin/actualites/${created.id}`);
}

/** Modification (l'adresse publique ne change pas, pour ne pas casser les liens partagés). */
export async function updateArticle(articleId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const parsed = ArticleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  await db.update(articles).set({ ...parsed.data, updatedAt: new Date() }).where(eq(articles.id, articleId));
  await logAudit({ userId: user.id, action: "UPDATE", entity: "article", entityId: articleId });
  revalidatePath(`/admin/actualites/${articleId}`);
  revalidatePublic();
  return { success: "Article enregistré." };
}

/** Publication / dépublication (EF-COM-01). La date de première publication est conservée. */
export async function setArticlePublished(articleId: number, published: boolean): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const [a] = await db.select({ publishedAt: articles.publishedAt }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return { error: "Article introuvable." };
  await db
    .update(articles)
    .set({ status: published ? "PUBLISHED" : "DRAFT", publishedAt: published ? (a.publishedAt ?? new Date()) : a.publishedAt, updatedAt: new Date() })
    .where(eq(articles.id, articleId));
  await logAudit({ userId: user.id, action: published ? "PUBLISH" : "UNPUBLISH", entity: "article", entityId: articleId });
  revalidatePath(`/admin/actualites/${articleId}`);
  revalidatePublic();
  return { success: published ? "Article publié." : "Article retiré du portail." };
}

/** Visuel de couverture : image JPEG, PNG ou WebP de 5 Mo au plus, type vérifié d'après le contenu. */
export async function uploadCover(articleId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) return { error: "L'image dépasse 5 Mo." };
  const kind = sniffKind(bytes);
  if (!kind || kind === "pdf") return { error: "Format non accepté : JPEG, PNG ou WebP." };

  const [a] = await db.select({ coverKey: articles.coverKey }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return { error: "Article introuvable." };
  const key = `article/${articleId}/${randomUUID()}.${kind}`;
  await putFile(key, bytes);
  await db.update(articles).set({ coverKey: key, coverType: MIME[kind], updatedAt: new Date() }).where(eq(articles.id, articleId));
  if (a.coverKey) await deleteFile(a.coverKey);
  await logAudit({ userId: user.id, action: "COVER", entity: "article", entityId: articleId });
  revalidatePath(`/admin/actualites/${articleId}`);
  revalidatePublic();
  return { success: "Visuel enregistré." };
}

/** Récupère les nouveaux articles de l'ancien site fecofoot.cg (jamais d'écrasement des articles déjà repris). */
export async function syncFromOldSite(): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  let report: Awaited<ReturnType<typeof syncNews>>;
  try {
    report = await syncNews({ mode: "new", maxPages: 5 });
  } catch (e) {
    return { error: `Synchronisation impossible : ${e instanceof Error ? e.message : "fecofoot.cg injoignable"}.` };
  }
  await logAudit({ userId: user.id, action: "NEWS_SYNC", entity: "article", details: { imported: report.imported, failed: report.failed.length } });
  revalidatePath("/admin/actualites");
  revalidatePublic();
  if (report.failed.length) return { error: `${report.imported} article(s) importé(s), ${report.failed.length} en échec : ${report.failed.slice(0, 3).join(" ; ")}` };
  return { success: report.imported ? `${report.imported} nouvel(s) article(s) importé(s) depuis fecofoot.cg.` : "Déjà à jour : aucun nouvel article sur fecofoot.cg." };
}

/** Suppression définitive d'un article (et de son visuel). Pour le masquer seulement : « Retirer du portail ». */
export async function deleteArticle(articleId: number): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  if (!(await deleteArticleRecord(articleId))) return { error: "Article introuvable." };
  await logAudit({ userId: user.id, action: "DELETE", entity: "article", entityId: articleId });
  revalidatePath("/admin/actualites");
  revalidatePublic();
  return { success: "Article supprimé." };
}
