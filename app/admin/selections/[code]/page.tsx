import type { Metadata } from "next";
import { EmptyState } from "@/components/admin/empty-state";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/format";
import { SELECTION_STATUS_LABELS } from "@/lib/national-teams";
import { teamGroups, teamPage } from "@/lib/queries/national";
import { seasonOf } from "@/lib/licenses";
import { RowActions } from "@/components/admin/row-actions";
import { can } from "@/lib/auth/roles";
import { photoUrl, teamPhotos } from "@/lib/photos";
import { addFixture, addGroupMatch, addStaff, createGroup, createSelection, deleteGroup, deleteGroupMatch, linkFixtureToGroup, removeStaff, setFixtureFeatured, setFixtureResult, setGroupMatchResult } from "../actions";
import { FeaturedToggle } from "@/components/featured-toggle";
import { FixtureForm, FixtureGroupForm, FixtureResultForm, GroupForm, GroupMatchForm, GroupMatchResultForm, SelectionCreateForm, StaffForm } from "../SelectionForms";

export const metadata: Metadata = { title: "Sélection nationale — FECOFOOT" };

export default async function NationalTeamPage({ params }: PageProps<"/admin/selections/[code]">) {
  const user = await requirePermission("national_teams.manage");
  const { code } = await params;
  const data = await teamPage(code, { publishedOnly: false });
  if (!data) notFound();
  const { team, staff, fixtures, selections } = data;
  const [gallery, groups] = await Promise.all([teamPhotos(team.id), teamGroups(team.id)]);
  const groupOptions = groups.map((g) => ({ id: g.group.id, label: `${g.competition.name} · ${g.group.name}` }));
  const canManagePhotos = can(user.role, "communication.manage");

  return (
    <>
      <PageHeader
        eyebrow="Équipes nationales"
        title={team.name}
        actions={
          <Link href={`/equipes-nationales/${team.slug}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
            Page publique
          </Link>
        }
      />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Listes de convoqués</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {selections.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <Link href={`/admin/selections/convocation/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                  {s.title}
                </Link>
                <StatusBadge tone={s.status === "PUBLISHED" ? "ok" : "neutral"}>{SELECTION_STATUS_LABELS[s.status]}</StatusBadge>
              </li>
            ))}
            {selections.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucune liste.</li>}
          </ul>
          <SelectionCreateForm action={createSelection.bind(null, team.code)} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Staff technique</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2">
                <span>
                  <strong>{s.fullName}</strong> — {s.role}
                </span>
                <form action={removeStaff.bind(null, team.code, s.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Retirer
                  </Button>
                </form>
              </li>
            ))}
            {staff.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun membre.</li>}
          </ul>
          <StaffForm action={addStaff.bind(null, team.code)} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Calendrier et résultats</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {fixtures.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="text-muted-foreground">{formatDateTime(f.kickoffAt)}</span> ·{" "}
                  <strong>{f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`}</strong>
                  {f.competition && <span className="text-muted-foreground"> · {f.competition}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <FeaturedToggle action={setFixtureFeatured.bind(null, team.code, f.id)} featured={f.featured} />
                  <FixtureResultForm action={setFixtureResult.bind(null, team.code, f.id)} current={f} />
                  {groupOptions.length > 0 && <FixtureGroupForm action={linkFixtureToGroup.bind(null, team.code, f.id)} groups={groupOptions} current={f} />}
                  <Link href={`/admin/selections/${team.code}/matchs/${f.id}`} className="admin-btn admin-btn-outline h-8 px-3 text-xs">
                    Feuille de match
                  </Link>
                </span>
              </li>
            ))}
            {fixtures.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun match.</li>}
          </ul>
          <FixtureForm action={addFixture.bind(null, team.code)} />
        </section>

        {/* Compétitions internationales : groupes, pays, matchs entre les autres pays (classement public du groupe). */}
        <section className="flex flex-col gap-4 border-t pt-6">
          <div>
            <h2 className="font-semibold">Compétitions et groupes</h2>
            <p className="text-sm text-muted-foreground">
              Rattachez chaque match du Congo à son groupe et à sa journée, puis saisissez les matchs entre les autres pays : la fiche publique du match affiche le
              classement du groupe et ses journées.
            </p>
          </div>
          {groups.map(({ group, competition, teams, matches }) => (
            <div key={group.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {competition.name} · {group.name} <span className="font-normal text-muted-foreground">({teams.join(", ")} · {group.qualifiers} qualifié(s))</span>
                </p>
                <RowActions name={`${competition.name} · ${group.name}`} onDelete={deleteGroup.bind(null, team.code, group.id)} />
              </div>
              {matches.length > 0 && (
                <ul className="flex flex-col divide-y rounded-md border text-sm">
                  {matches.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span>
                        <span className="text-muted-foreground">J{m.matchday}{m.kickoffAt ? ` · ${formatDateTime(m.kickoffAt)}` : ""}</span> ·{" "}
                        <strong>
                          {m.home} – {m.away}
                        </strong>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <GroupMatchResultForm action={setGroupMatchResult.bind(null, team.code, m.id)} current={m} />
                        <RowActions name={`${m.home} – ${m.away}`} onDelete={deleteGroupMatch.bind(null, team.code, m.id)} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {teams.length > 2 && <GroupMatchForm action={addGroupMatch.bind(null, team.code, group.id)} teams={teams} />}
            </div>
          ))}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-semibold">Nouveau groupe</summary>
            <div className="mt-4">
              <GroupForm action={createGroup.bind(null, team.code)} season={seasonOf()} />
            </div>
          </details>
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="photos-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="photos-title" className="font-semibold">
              Photos publiées <span className="font-normal text-muted-foreground">({gallery.length})</span>
            </h2>
            {canManagePhotos && (
              <Link href={`/admin/photos?equipe=${team.slug}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                Gérer dans la photothèque
              </Link>
            )}
          </div>
          {gallery.length === 0 ? (
            <EmptyState icon="photo" title="Aucune photo publiée" compact />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {gallery.slice(0, 12).map((p) => (
                <li key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                  <img src={photoUrl(p)} alt={p.caption} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted-foreground">Dernière mise à jour : {formatDate(new Date())}</p>
      </div>
    </>
  );
}
