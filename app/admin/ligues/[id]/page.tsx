import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { ActionForm } from "@/components/admin/action-form";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { UploadForm } from "@/components/admin/upload-form";
import { MatchLine } from "@/components/competitions/match-line";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can, canManageLeague, ROLE_LABELS } from "@/lib/auth/roles";
import { CLUB_STATUS_LABELS } from "@/lib/clubs";
import { COMPETITION_CATEGORY_LABELS, COMPETITION_STATUS_LABELS } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitions, competitionTeams, leagues, matches, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { matchQuery } from "@/lib/queries/competitions";
import { setLeagueActive, updateLeague, uploadLeagueLogo } from "../actions";
import { LeagueForm } from "../LeagueForm";

export const metadata: Metadata = { title: "Ligue — FECOFOOT" };

/** Fiche d'une ligue : présentation et coordonnées, logo, clubs, compétitions, matchs, comptes. */
export default async function LeaguePage({ params }: PageProps<"/admin/ligues/[id]">) {
  const user = await requireAnyPermission("leagues.manage", "leagues.own");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  if (!canManageLeague(user, id)) redirect("/admin/acces-refuse");
  const federation = can(user.role, "leagues.manage");
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) notFound();

  const [clubRows, accounts, comps] = await Promise.all([
    db.select().from(clubs).where(eq(clubs.leagueId, id)).orderBy(asc(clubs.name)),
    db
      .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.leagueId, id))
      .orderBy(asc(users.fullName)),
    db
      .select({ c: competitions, teams: count(competitionTeams.id) })
      .from(competitions)
      .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
      .where(eq(competitions.leagueId, id))
      .groupBy(competitions.id)
      .orderBy(desc(competitions.season), asc(competitions.name)),
  ]);
  const compIds = comps.map((r) => r.c.id);
  const [upcoming, results] = compIds.length
    ? await Promise.all([
        matchQuery()
          .where(and(inArray(matches.competitionId, compIds), inArray(matches.status, ["SCHEDULED", "POSTPONED", "LIVE", "HALF_TIME"]), gte(matches.kickoffAt, sql`now() - interval '3 hours'`)))
          .orderBy(asc(matches.kickoffAt))
          .limit(5),
        matchQuery()
          .where(and(inArray(matches.competitionId, compIds), eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt)))
          .orderBy(desc(matches.kickoffAt))
          .limit(5),
      ])
    : [[], []];
  const affiliated = clubRows.filter((c) => c.status === "AFFILIATED").length;
  const logo = leagueLogoUrl(league);

  return (
    <>
      <PageHeader
        eyebrow={`Organisation · Ligues · ${league.code}`}
        title={league.name}
        description={[league.department && `Département : ${league.department}`, league.president ? `Présidée par ${league.president}` : "Président non renseigné", !league.active && "Ligue désactivée"]
          .filter(Boolean)
          .join(" · ")}
        actions={
          federation && (
            <Link href="/admin/ligues" className="admin-btn admin-btn-outline">
              ← Toutes les ligues
            </Link>
          )
        }
      />
      <StatCards
        stats={[
          { label: "Clubs affiliés", value: affiliated, sub: `${clubRows.length} club(s) au total` },
          { label: "Compétitions", value: comps.length, sub: `${comps.filter((r) => r.c.status === "ONGOING").length} en cours` },
          { label: "Matchs à venir", value: upcoming.length },
          { label: "Comptes de ligue", value: accounts.length },
        ]}
      />
      <div className="flex flex-col gap-5">
        {!league.active && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge tone="bad">Désactivée</StatusBadge>
            Masquée du portail, fermée aux nouveaux clubs et compétitions ; ses clubs, matchs et résultats sont conservés.
          </p>
        )}

        <section id="modifier" className="flex flex-col gap-4">
          <h2>Informations de la ligue</h2>
          <LeagueForm action={updateLeague.bind(null, league.id)} initial={league} identity={federation} />
        </section>

        <section className="flex flex-col gap-4">
          <h2>Logo</h2>
          <div className="flex flex-wrap items-center gap-4">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={`Logo — ${league.name}`} className="size-20 rounded-lg border bg-white object-contain p-1" />
            ) : (
              <span className="league-code">{league.code}</span>
            )}
            <UploadForm action={uploadLeagueLogo.bind(null, league.id)} accept="image/jpeg,image/png,image/webp" label={logo ? "Remplacer le logo" : "Téléverser le logo"} />
          </div>
        </section>

        {federation && (
          <section className="flex flex-col gap-3">
            <h2>{league.active ? "Désactiver la ligue" : "Réactiver la ligue"}</h2>
            <p className="text-sm text-muted-foreground">
              {league.active
                ? "La ligue disparaît du portail et ne reçoit plus de nouveaux clubs ni de nouvelles compétitions. Rien n'est supprimé."
                : "La ligue réapparaît sur le portail et peut de nouveau recevoir des clubs et des compétitions."}
            </p>
            <ActionForm
              action={setLeagueActive.bind(null, league.id, !league.active)}
              label={league.active ? "Désactiver la ligue" : "Réactiver la ligue"}
              variant={league.active ? "destructive" : "default"}
            />
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2>
            Compétitions organisées <span className="text-sm font-normal text-muted-foreground">· {comps.length}</span>
          </h2>
          {comps.length === 0 ? (
            <EmptyState icon="calendar" title="Aucune compétition" compact action={{ href: "/admin/competitions/nouveau", label: "Créer une compétition" }}>
              Championnat départemental, coupe de la ligue, compétitions de jeunes ou féminines.
            </EmptyState>
          ) : (
            <DataTable head={["Compétition", "Saison", "Catégorie", "Clubs", "Statut"]} pageSize={5}>
              {comps.map(({ c, teams }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/competitions/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{seasonLabel(c.season)}</td>
                  <td>
                    {COMPETITION_CATEGORY_LABELS[c.category]}
                    {c.gender === "F" ? " · Féminin" : ""}
                  </td>
                  <td className="tabular-nums">{teams}</td>
                  <td>
                    <StatusBadge tone={c.status === "ONGOING" ? "ok" : c.status === "DRAFT" ? "wait" : "neutral"}>{COMPETITION_STATUS_LABELS[c.status]}</StatusBadge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        {(upcoming.length > 0 || results.length > 0) && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-3">
              <h2>Prochains matchs</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun match programmé.</p>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {upcoming.map((m) => (
                    <MatchLine key={m.match.id} row={m} href={`/admin/matchs/${m.match.id}`} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <h2>Derniers résultats</h2>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun résultat validé.</p>
              ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                  {results.map((m) => (
                    <MatchLine key={m.match.id} row={m} href={`/admin/matchs/${m.match.id}`} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2>
            Clubs rattachés <span className="text-sm font-normal text-muted-foreground">· {clubRows.length}</span>
          </h2>
          {clubRows.length === 0 ? (
            <EmptyState icon="shield" title="Aucun club rattaché" compact action={{ href: "/admin/clubs/nouveau", label: "Créer un club" }} />
          ) : (
            <DataTable head={["N° d'affiliation", "Club", "Ville", "Statut"]} pageSize={5}>
              {clubRows.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.affiliationNumber}</td>
                  <td>
                    <Link href={`/admin/clubs/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.city}</td>
                  <td>
                    <StatusBadge tone={c.status === "AFFILIATED" ? "ok" : c.status === "PENDING" ? "wait" : "bad"}>{CLUB_STATUS_LABELS[c.status]}</StatusBadge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2>
            Comptes de la ligue <span className="text-sm font-normal text-muted-foreground">· {accounts.length}</span>
          </h2>
          {accounts.length === 0 ? (
            <EmptyState icon="users" title="Aucun compte de ligue" compact action={federation ? { href: "/admin/utilisateurs/nouveau", label: "Créer un compte" } : undefined}>
              Un compte de ligue instruit les licences et les transferts des clubs de la ligue et gère ses compétitions départementales.
            </EmptyState>
          ) : (
            <DataTable head={["Nom", "Profil", "Dernière connexion", "État"]} pageSize={5}>
              {accounts.map((u) => (
                <tr key={u.id}>
                  <td>
                    {federation ? <Link href={`/admin/utilisateurs/${u.id}`}>{u.fullName}</Link> : u.fullName}
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</td>
                  <td>
                    <StatusBadge tone={u.active ? "ok" : "neutral"}>{u.active ? "Actif" : "Désactivé"}</StatusBadge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </>
  );
}
