import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { DocumentsPanel } from "@/components/admin/documents-panel";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { can, canAccessClub } from "@/lib/auth/roles";
import { CLUB_STATUS_LABELS } from "@/lib/clubs";
import { db } from "@/lib/db";
import { clubOfficials, clubs, leagues } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { latestDocuments } from "@/lib/queries/documents";
import { leagueOptions } from "@/lib/queries/reference";
import { addOfficial, removeOfficial, setClubStatus, updateClub } from "../actions";
import { ClubForm, OfficialForm, StatusForm } from "../ClubForms";

export const metadata: Metadata = { title: "Fiche club — FECOFOOT" };

export default async function ClubPage({ params }: PageProps<"/admin/clubs/[id]">) {
  const user = await requirePermission("clubs.read");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [row] = await db
    .select({ club: clubs, league: leagues.name })
    .from(clubs)
    .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
    .where(eq(clubs.id, id))
    .limit(1);
  if (!row) notFound();
  const { club } = row;
  if (!canAccessClub(user, club)) redirect("/admin/acces-refuse");

  const canEdit = can(user.role, "clubs.manage");
  const [officials, allLeagues, docs] = await Promise.all([
    db.select().from(clubOfficials).where(eq(clubOfficials.clubId, club.id)).orderBy(asc(clubOfficials.fullName)),
    canEdit ? leagueOptions() : Promise.resolve([]),
    latestDocuments("club", club.id),
  ]);
  const leagueChoices = user.role === "LEAGUE" ? allLeagues.filter((l) => l.id === user.leagueId) : allLeagues;

  return (
    <>
      <PageHeader
        eyebrow={`Organisation · ${club.affiliationNumber}`}
        title={club.name}
        description={`${row.league ?? "Fédération — division nationale"} · ${club.city} · ${CLUB_STATUS_LABELS[club.status]} · créé le ${formatDate(club.createdAt)}`}
      />

      <div className="flex flex-col gap-10">
        {can(user.role, "clubs.affiliate") && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Affiliation</h2>
            <StatusForm action={setClubStatus.bind(null, club.id)} current={club.status} />
          </section>
        )}

        <section id="modifier" className="flex flex-col gap-3">
          <h2 className="font-semibold">Informations</h2>
          {canEdit ? (
            <ClubForm action={updateClub.bind(null, club.id)} leagues={leagueChoices} initial={club} submitLabel="Enregistrer" />
          ) : (
            <dl className="grid max-w-2xl gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {(
                [
                  ["Sigle", club.shortName],
                  ["Stade", club.stadium],
                  ["Couleurs", club.colors],
                  ["Fondation", club.foundedYear],
                  ["E-mail", club.email],
                  ["Téléphone", club.phone],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Logo et pièces d&apos;affiliation</h2>
          <DocumentsPanel ownerType="club" ownerId={club.id} latest={docs} canManage={canEdit} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Dirigeants et encadrement</h2>
          {officials.length === 0 ? (
            <EmptyState icon="users" title="Aucun dirigeant enregistré" compact>Ajoutez le président, le secrétaire général et l’encadrement avec le formulaire ci-dessous.</EmptyState>
          ) : (
            <ul className="divide-y rounded-lg border">
              {officials.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{o.fullName}</p>
                    <p className="text-muted-foreground">
                      {o.position}
                      {o.phone && ` · ${o.phone}`}
                      {o.email && ` · ${o.email}`}
                    </p>
                  </div>
                  {canEdit && (
                    <form action={removeOfficial.bind(null, club.id, o.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Retirer
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && <OfficialForm action={addOfficial.bind(null, club.id)} />}
        </section>
      </div>
    </>
  );
}
