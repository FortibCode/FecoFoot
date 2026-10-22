import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import type { ReactNode } from "react";
import { asc, desc, eq, ne } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can, canAccessClub, canAccessCompetition } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, competitions, nationalTeams, selections } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";

export const metadata: Metadata = { title: "Exports et états — FECOFOOT" };

/** Bloc d'un export : titre, explication courte, commandes. */
function ExportCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-heading text-lg font-semibold uppercase">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </section>
  );
}

const formats = (href: (format: "xlsx" | "pdf") => string, label?: string) => (
  <span className="flex shrink-0 gap-2">
    <a href={href("xlsx")} className="admin-btn admin-btn-outline" aria-label={label ? `${label} : Excel` : undefined}>
      Excel
    </a>
    <a href={href("pdf")} className="admin-btn admin-btn-outline" aria-label={label ? `${label} : PDF` : undefined}>
      PDF
    </a>
  </span>
);

/** Exports et états (M19, EF-EXP-01) : tous les documents Excel et PDF au même endroit, selon les droits. */
export default async function ExportsPage() {
  const user = await requireAnyPermission("licenses.validate", "licenses.request", "competitions.manage", "national_teams.manage", "payments.manage", "audit.read");
  const season = seasonOf();
  const canLicenses = can(user.role, "licenses.validate") || can(user.role, "licenses.request");
  const [clubRows, comps, lists] = await Promise.all([
    canLicenses ? db.select({ id: clubs.id, name: clubs.name, leagueId: clubs.leagueId }).from(clubs).orderBy(asc(clubs.name)) : [],
    can(user.role, "competitions.manage")
      ? db.select().from(competitions).where(ne(competitions.status, "DRAFT")).orderBy(desc(competitions.season), asc(competitions.name))
      : [],
    can(user.role, "national_teams.manage")
      ? db
          .select({ id: selections.id, title: selections.title, status: selections.status, createdAt: selections.createdAt, team: nationalTeams.name })
          .from(selections)
          .innerJoin(nationalTeams, eq(selections.teamId, nationalTeams.id))
          .orderBy(desc(selections.createdAt))
          .limit(20)
      : [],
  ]);
  // Classements : seulement les compétitions du périmètre (une ligue : les siennes).
  const myComps = comps.filter((c) => canAccessCompetition(user, c));
  const myClubs = user.role === "CLUB" ? [] : clubRows.filter((c) => canAccessClub(user, c) || user.role === "SUPER_ADMIN" || user.role === "FEDERATION_ADMIN");
  const select = "h-10 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm";

  return (
    <>
      <PageHeader eyebrow="Administration" title="Exports et états" description="Documents Excel et PDF de la plateforme, à jour au moment du téléchargement." />
      <div className="grid gap-4 lg:grid-cols-2">
        {canLicenses && (
          <ExportCard title="Licences d'un club" text="Liste des licences d'un club pour une saison : joueur, identifiant fédéral, catégorie, statut, droits.">
            <form action="/admin/exports/licences" className="flex flex-wrap items-center gap-2">
              {user.role !== "CLUB" && (
                <select name="club" required aria-label="Club" className={select} defaultValue="">
                  <option value="" disabled>
                    Choisir un club
                  </option>
                  {myClubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <select name="season" aria-label="Saison" className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={season}>
                {[season, season - 1, season - 2].map((s) => (
                  <option key={s} value={s}>
                    {seasonLabel(s)}
                  </option>
                ))}
              </select>
              <button type="submit" name="format" value="xlsx" className="admin-btn admin-btn-outline">
                Excel
              </button>
              <button type="submit" name="format" value="pdf" className="admin-btn admin-btn-outline">
                PDF
              </button>
            </form>
          </ExportCard>
        )}

        {can(user.role, "competitions.manage") && (
          <ExportCard title="Classements" text="Classement et meilleurs buteurs de chaque compétition publiée.">
            {myComps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune compétition publiée (les brouillons n&apos;ont pas encore de classement).</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {myComps.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{c.name}</span> <span className="text-muted-foreground">· {seasonLabel(c.season)}</span>
                    </span>
                    {formats((f) => `/admin/exports/classement/${c.id}?format=${f}`, c.name)}
                  </li>
                ))}
              </ul>
            )}
          </ExportCard>
        )}

        {can(user.role, "national_teams.manage") && (
          <ExportCard title="Convocations des sélections" text="Liste des joueurs convoqués et lettres de convocation adressées aux clubs.">
            {lists.length === 0 ? (
              <EmptyState icon="users" title="Aucune liste de convoqués" compact />
            ) : (
              <ul className="flex flex-col divide-y">
                {lists.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{s.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.team} · {formatDate(s.createdAt)}
                        {s.status !== "PUBLISHED" && " · brouillon"}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {formats((f) => `/admin/exports/convocation/${s.id}?format=${f}`, s.title)}
                      <a href={`/admin/exports/convocation/${s.id}/lettres`} className="admin-btn admin-btn-outline">
                        Lettres
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ExportCard>
        )}

        {can(user.role, "payments.manage") && (
          <ExportCard title="Paiements" text="Tous les paiements (Mobile Money et guichet), avec leur état et leur référence. Filtres disponibles dans la page Paiements.">
            <span className="flex gap-2">
              <a href="/admin/paiements/export" className="admin-btn admin-btn-outline">
                Excel
              </a>
              <a href="/admin/paiements" className="admin-btn admin-btn-outline">
                Filtrer avant l&apos;export
              </a>
            </span>
          </ExportCard>
        )}

        {can(user.role, "audit.read") && (
          <ExportCard title="Journal d'audit" text="Connexions, refus et opérations sensibles. Filtres par action et par période dans le journal.">
            <span className="flex gap-2">
              <a href="/admin/journal/export" className="admin-btn admin-btn-outline">
                Excel
              </a>
              <a href="/admin/journal" className="admin-btn admin-btn-outline">
                Filtrer avant l&apos;export
              </a>
            </span>
          </ExportCard>
        )}
      </div>
    </>
  );
}
