import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { asc, desc, eq, isNull, type SQL } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams, photos } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { MAX_FEATURED, photoUrl } from "@/lib/photos";
import { deletePhoto, setPhotoFlag, updatePhoto, uploadPhoto } from "./actions";
import { PhotoButton, PhotoDetailsForm, PhotoUploader } from "./PhotoForms";

export const metadata: Metadata = { title: "Photothèque — FECOFOOT" };

/** Photothèque : photos des sélections et du football congolais, publiées sur le portail (M14). */
export default async function AdminPhotosPage({ searchParams }: PageProps<"/admin/photos">) {
  await requirePermission("communication.manage");
  const raw = (await searchParams).equipe;
  const filter = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const teams = await db.select({ id: nationalTeams.id, name: nationalTeams.name, slug: nationalTeams.slug }).from(nationalTeams).orderBy(asc(nationalTeams.id));
  const team = teams.find((t) => t.slug === filter);
  const where: SQL | undefined = filter === "generales" ? isNull(photos.teamId) : team ? eq(photos.teamId, team.id) : undefined;
  const rows = await db.select().from(photos).where(where).orderBy(desc(photos.createdAt), desc(photos.id)).limit(300);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const chip = (slug: string, label: string) => (
    <Link
      key={slug}
      href={slug ? `/admin/photos?equipe=${slug}` : "/admin/photos"}
      aria-current={filter === slug ? "page" : undefined}
      className={`rounded-md border px-3 py-1.5 text-sm ${filter === slug ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader eyebrow="Communication" title="Photothèque" description={`${rows.length} photo(s) · les photos « à la une » défilent dans le bandeau de la page d'accueil (${MAX_FEATURED} au plus, les plus récentes ; de préférence au format paysage).`} />
      <div className="flex flex-col gap-8">
        <PhotoUploader action={uploadPhoto} teams={teams} defaultTeamId={team?.id} />

        <nav aria-label="Filtrer par sélection" className="flex flex-wrap gap-2">
          {chip("", "Toutes")}
          {teams.map((t) => chip(t.slug, t.name))}
          {chip("generales", "Générales")}
        </nav>

        {rows.length === 0 ? (
          <EmptyState icon="photo" title="Aucune photo">Ajoutez des photos avec le formulaire ci-dessus ; elles pourront être publiées sur le portail et mises à la une.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <li key={p.id} data-testid="photo-card" className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <a href={photoUrl(p)} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                  <img src={photoUrl(p)} alt={p.caption || `Photo ${p.id}`} loading="lazy" className="size-full object-cover" />
                  <span className="absolute top-2 left-2 flex gap-1.5">
                    {p.featured && <StatusBadge tone="wait">À la une</StatusBadge>}
                    <StatusBadge tone={p.published ? "ok" : "neutral"}>{p.published ? "Publiée" : "Masquée"}</StatusBadge>
                  </span>
                </a>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="text-xs text-muted-foreground">
                    {p.teamId ? teamName.get(p.teamId) : "Photo générale"} · {p.width} × {p.height} · ajoutée le {formatDate(p.createdAt)}
                  </p>
                  <PhotoDetailsForm action={updatePhoto.bind(null, p.id)} teams={teams} caption={p.caption} teamId={p.teamId} />
                  <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
                    {p.featured ? (
                      <PhotoButton action={setPhotoFlag.bind(null, p.id, "featured", false)} label="Retirer de la une" />
                    ) : (
                      <PhotoButton action={setPhotoFlag.bind(null, p.id, "featured", true)} label="Mettre à la une" variant="default" />
                    )}
                    <PhotoButton action={setPhotoFlag.bind(null, p.id, "published", !p.published)} label={p.published ? "Masquer" : "Publier"} />
                    <PhotoButton action={deletePhoto.bind(null, p.id)} label="Supprimer" variant="destructive" confirm="Supprimer définitivement cette photo ?" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
