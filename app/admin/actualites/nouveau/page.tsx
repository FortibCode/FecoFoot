import type { Metadata } from "next";
import { nationalTeams } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { createArticle } from "../actions";
import { ArticleForm } from "../ArticleForm";

export const metadata: Metadata = { title: "Nouvel article — FECOFOOT" };

export default async function NewArticlePage() {
  await requirePermission("communication.manage");
  return (
    <>
      <PageHeader eyebrow="Communication · Actualités" title="Nouvel article" description="L'article est créé en brouillon : ajoutez un visuel, vérifiez l'aperçu, puis publiez." />
      <ArticleForm teams={await db.select({ id: nationalTeams.id, name: nationalTeams.name }).from(nationalTeams).orderBy(nationalTeams.id)} action={createArticle} submitLabel="Créer le brouillon" />
    </>
  );
}
