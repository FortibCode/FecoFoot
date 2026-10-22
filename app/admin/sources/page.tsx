import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { ActionForm } from "@/components/admin/action-form";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { canAccessCompetition } from "@/lib/auth/roles";
import { MATCH_STATUS_LABELS, type MatchStatus } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitions, externalConflicts, externalLinks, externalSyncRuns, matches } from "@/lib/db/schema";
import { normalizeClubName } from "@/lib/external-sync-rules";
import { formatDateTime } from "@/lib/format";
import { apiFootballConfigured, ExternalApiError, leaguesOfCountry, teamsOf, type ApiLeague, type ApiTeam } from "@/lib/integrations/api-football";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { homeClub, awayClub } from "@/lib/queries/competitions";
import { linkClub, linkCompetition, resolveConflict, syncNow, unlinkCompetition, validateExternalResults } from "./actions";
import { ClubLinkForm, LinkCompetitionForm } from "./SourceForms";

export const metadata: Metadata = { title: "Sources externes — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const scoreOf = (v: unknown) => {
  const o = v as { status?: MatchStatus; score?: (number | null)[] };
  return `${o.status ? MATCH_STATUS_LABELS[o.status] : "?"}${o.score && o.score[0] !== null ? ` · ${o.score[0]} – ${o.score[1]}` : ""}`;
};

/**
 * Sources sportives externes (scores et calendriers) : liaison des compétitions et des clubs,
 * synchronisation, journal et conflits. La saisie officielle prime toujours (lib/external-sync-rules.ts).
 */
export default async function SourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) redirect("/admin/acces-refuse");
  const sp = await searchParams;
  const country = one(sp.pays);
  const teamsFor = Number(one(sp.equipes)) || undefined;
  const configured = apiFootballConfigured();

  const [links, comps, runs, conflicts, allClubs, clubLinks] = await Promise.all([
    db
      .select({
        link: externalLinks,
        name: competitions.name,
        season: competitions.season,
        // Résultats importés terminés, pas encore validés par la fédération (hors classement).
        pending: sql<number>`(select count(*)::int from ${matches} where ${matches.competitionId} = ${competitions.id} and ${matches.status} = 'FINISHED' and ${matches.scoreSource} = 'EXTERNAL' and ${matches.validatedAt} is null)`,
      })
      .from(externalLinks)
      .innerJoin(competitions, eq(competitions.id, externalLinks.entityId))
      .where(and(eq(externalLinks.provider, "API_FOOTBALL"), eq(externalLinks.entity, "competition"))),
    db.select({ id: competitions.id, name: competitions.name, season: competitions.season }).from(competitions).where(isNull(competitions.leagueId)).orderBy(desc(competitions.season), asc(competitions.name)),
    db.select({ run: externalSyncRuns, name: competitions.name }).from(externalSyncRuns).leftJoin(competitions, eq(competitions.id, externalSyncRuns.competitionId)).orderBy(desc(externalSyncRuns.startedAt)).limit(10),
    db
      .select({ c: externalConflicts, matchId: matches.id, home: homeClub.name, away: awayClub.name })
      .from(externalConflicts)
      .innerJoin(matches, eq(matches.id, externalConflicts.matchId))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(isNull(externalConflicts.resolvedAt))
      .orderBy(desc(externalConflicts.detectedAt)),
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).orderBy(asc(clubs.name)),
    db.select().from(externalLinks).where(and(eq(externalLinks.provider, "API_FOOTBALL"), eq(externalLinks.entity, "club"))),
  ]);

  // Données du fournisseur, seulement à la demande (chaque appel consomme le quota).
  let leagues: ApiLeague[] = [];
  let teams: ApiTeam[] = [];
  let apiError: string | null = null;
  const teamsLink = teamsFor ? links.find((l) => l.link.entityId === teamsFor) : undefined;
  try {
    if (configured && country) leagues = (await leaguesOfCountry(country)).data;
    if (configured && teamsLink) teams = (await teamsOf(Number(teamsLink.link.externalId), teamsLink.link.externalSeason)).data;
  } catch (e) {
    apiError = e instanceof ExternalApiError ? e.message : "Erreur inattendue du fournisseur.";
  }
  const clubByExternal = new Map(clubLinks.map((l) => [l.externalId, l.entityId]));
  const suggestion = (name: string) => allClubs.find((c) => normalizeClubName(c.name) === normalizeClubName(name))?.id ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Sport · Compétitions"
        title="Sources externes"
        description="Calendriers et scores importés d'un fournisseur de données sportives. La saisie officielle prime : un résultat validé n'est jamais modifié."
      />
      <StatCards
        stats={[
          { label: "Fournisseur", value: configured ? "Configuré" : "Non configuré", sub: "API-Football (api-sports.io)" },
          { label: "Compétitions liées", value: links.length },
          { label: "Clubs associés", value: clubLinks.length },
          { label: "Conflits à examiner", value: conflicts.length },
        ]}
      />
      <div className="flex flex-col gap-5">
        {!configured && (
          <section className="flex flex-col gap-2">
            <h2>Mise en service</h2>
            <ol className="list-decimal pl-5 text-sm leading-relaxed">
              <li>Créer un compte sur api-football.com et vérifier, avec l&apos;offre gratuite, la couverture de la Ligue 1 du Congo (calendrier, scores, direct).</li>
              <li>Renseigner la clé dans l&apos;environnement du serveur : <code>API_FOOTBALL_KEY=…</code> (jamais dans le code), puis redémarrer.</li>
              <li>Rechercher la ligue ci-dessous, la lier à la saison de la plateforme, associer les équipes aux clubs, synchroniser.</li>
              <li>Pour le direct : appel planifié de <code>/api/integrations/sync</code> (voir la documentation), selon le quota de l&apos;abonnement.</li>
            </ol>
          </section>
        )}
        {apiError && (
          <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
            {apiError}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2>1. Trouver la ligue chez le fournisseur</h2>
          <form className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1">
              Pays (nom du fournisseur)
              <input name="pays" defaultValue={country ?? "Congo"} className="admin-input" style={{ maxWidth: 200 }} />
            </label>
            <button type="submit" className="admin-btn admin-btn-outline" disabled={!configured}>
              Rechercher
            </button>
          </form>
          <p className="text-xs text-muted-foreground">« Congo » : République du Congo (Brazzaville). La RD Congo est « Congo-DR ». Une recherche consomme une requête du quota.</p>
          {leagues.length > 0 && (
            <DataTable head={["N°", "Ligue", "Type", "Saisons (couverture)"]}>
              {leagues.map((l) => (
                <tr key={l.league.id}>
                  <td className="font-mono">{l.league.id}</td>
                  <td className="font-semibold">{l.league.name}</td>
                  <td>{l.league.type}</td>
                  <td className="text-xs">
                    {l.seasons
                      .slice(-4)
                      .map((s) => `${s.year}${s.current ? " (en cours)" : ""}${s.coverage?.fixtures?.events ? " · buts" : ""}${s.coverage?.standings ? " · classement" : ""}`)
                      .join(" | ")}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>2. Lier une compétition</h2>
          <LinkCompetitionForm action={linkCompetition} competitions={comps.map((c) => ({ id: c.id, name: `${c.name} (${seasonLabel(c.season)})` }))} defaultSeason={seasonOf()} />
          {links.length === 0 ? (
            <EmptyState icon="calendar" title="Aucune compétition liée" compact />
          ) : (
            <DataTable head={["Compétition", "Ligue / saison du fournisseur", "Actions"]}>
              {links.map(({ link, name, season, pending }) => (
                <tr key={link.id}>
                  <td>
                    <Link href={`/admin/competitions/${link.entityId}`} className="font-semibold">
                      {name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{seasonLabel(season)}</span>
                    {pending > 0 && <span className="block text-xs text-[var(--flag-red,#dc241f)]">{pending} résultat(s) importé(s) à valider (hors classement)</span>}
                  </td>
                  <td className="font-mono text-sm">
                    {link.externalId} / {link.externalSeason}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionForm action={syncNow.bind(null, link.entityId)} label="Synchroniser" variant="default" />
                      <Link href={`/admin/sources?equipes=${link.entityId}`} className="admin-btn admin-btn-outline">
                        Équipes
                      </Link>
                      {pending > 0 && <ActionForm action={validateExternalResults.bind(null, link.entityId)} label={`Valider les ${pending} résultats`} />}
                      <ActionForm action={unlinkCompetition.bind(null, link.entityId)} label="Délier" variant="destructive" />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        {teamsLink && (
          <section className="flex flex-col gap-3">
            <h2>3. Associer les équipes — {teamsLink.name}</h2>
            <p className="text-sm text-muted-foreground">Chaque équipe du fournisseur doit correspondre à un club de la plateforme. Aucun club n&apos;est créé automatiquement : les équipes non associées sont ignorées.</p>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune équipe renvoyée par le fournisseur pour cette ligue et cette saison.</p>
            ) : (
              <DataTable head={["Équipe (fournisseur)", "Club de la plateforme"]}>
                {teams.map((t) => (
                  <tr key={t.team.id}>
                    <td>
                      <span className="font-semibold">{t.team.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">n° {t.team.id}</span>
                    </td>
                    <td>
                      <ClubLinkForm action={linkClub.bind(null, t.team.id)} clubs={allClubs} suggested={suggestion(t.team.name)} linkedClubId={clubByExternal.get(String(t.team.id)) ?? null} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2>Conflits à examiner</h2>
          {conflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun écart entre la source externe et les données officielles.</p>
          ) : (
            <DataTable head={["Match", "Officiel", "Source externe", "Motif", ""]}>
              {conflicts.map(({ c, matchId, home, away }) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/matchs/${matchId}`} className="font-semibold">
                      {home} – {away}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(c.detectedAt)}</span>
                  </td>
                  <td>{scoreOf(c.officialValue)}</td>
                  <td>{scoreOf(c.externalValue)}</td>
                  <td className="text-xs">{c.reason}</td>
                  <td>
                    <ActionForm action={resolveConflict.bind(null, c.id)} label="Garder l'officiel" />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Dernières synchronisations</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune synchronisation pour le moment.</p>
          ) : (
            <DataTable head={["Date", "Compétition", "Déclenchement", "Résultat", "Détails"]}>
              {runs.map(({ run, name }) => (
                <tr key={run.id}>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{name ?? "—"}</td>
                  <td>{run.trigger === "cron" ? "Planifié" : "Manuel"}</td>
                  <td>
                    {run.error ? (
                      <StatusBadge tone="bad">Échec</StatusBadge>
                    ) : (
                      <span className="text-sm">
                        {run.created} créé(s), {run.updated} mis à jour, {run.conflicts} conflit(s), {run.skipped} ignoré(s)
                      </span>
                    )}
                  </td>
                  <td className="text-xs">{run.error ?? ((run.notes as string[] | null) ?? []).join(" ")}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </>
  );
}
