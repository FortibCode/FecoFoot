import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MatchLine } from "@/components/competitions/match-line";
import { FollowClubButton } from "@/components/matches/favorites";
import { PublicShell } from "@/components/public/public-shell";
import { TEAM_OUTCOME_LABELS } from "@/lib/competitions";
import { clubParticipations } from "@/lib/queries/championships";
import { db } from "@/lib/db";
import { clubs, leagues, licenses, matches, players } from "@/lib/db/schema";
import { POSITION_LABELS, POSITIONS, seasonLabel, seasonOf } from "@/lib/licenses";
import { matchQuery } from "@/lib/queries/competitions";
import { ClubLogo } from "@/components/public/club-logo";
import { clubLogos } from "@/lib/club-logos";

async function load(slug: string) {
  const [row] = await db
    .select({ club: clubs, league: leagues.name })
    .from(clubs)
    .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
    .where(and(eq(clubs.slug, slug), eq(clubs.status, "AFFILIATED")))
    .limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  const row = await load((await params).slug);
  return row ? { title: `${row.club.name} — FECOFOOT`, description: `${row.club.name} (${row.club.city}) : effectif licencié, résultats.` } : {};
}

/** Fiche club publique : stade, effectif licencié limité au nom et au poste, résultats (EF-PUB-04). */
export default async function PublicClubPage({ params }: PageProps<"/clubs/[slug]">) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const { club } = row;
  const season = seasonOf();
  const [squad, results, logos] = await Promise.all([
    // Données publiques minimales : nom et poste (pas de date de naissance, pas de coordonnées).
    db
      .select({ id: players.id, lastName: players.lastName, firstName: players.firstName, position: players.position })
      .from(licenses)
      .innerJoin(players, eq(licenses.playerId, players.id))
      .where(and(eq(licenses.clubId, club.id), eq(licenses.season, season), eq(licenses.status, "VALIDATED")))
      .orderBy(asc(players.lastName)),
    matchQuery()
      .where(and(or(eq(matches.homeClubId, club.id), eq(matches.awayClubId, club.id)), eq(matches.status, "FINISHED"), isNotNull(matches.validatedAt)))
      .orderBy(desc(matches.kickoffAt))
      .limit(10),
    clubLogos([club.id]),
  ]);

  const participations = await clubParticipations(club.id);

  return (
    <PublicShell eyebrow={`${club.city} · ${row.league ?? "Division nationale"}`} title={club.name} wide>
      <div className="mb-8 flex flex-wrap items-center gap-6 rounded-2xl bg-muted/60 p-6">
        <div className="flex flex-col items-center gap-3">
          <ClubLogo src={logos.get(club.id)} name={club.name} className="size-28 sm:size-32" />
          {/* Clubs suivis : leurs matchs sont repérés et filtrables sur la page « Matchs et résultats ». */}
          <FollowClubButton clubId={club.id} name={club.name} />
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {(
            [
              ["Ville", club.city],
              ["Rattachement", row.league ?? "Fédération — division nationale"],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="font-heading text-lg font-bold">{v}</dd>
              </div>
            ))}
        </dl>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-bold">Derniers résultats</h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat.</p>
          ) : (
            <div className="divide-y rounded-lg shadow-sm">
              {results.map((m) => (
                <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
              ))}
            </div>
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-3 lg:col-start-1">
          <h2 className="text-lg font-bold">Participations</h2>
          {participations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune participation publiée.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg text-sm shadow-sm">
              {participations.map((p) => (
                <li key={p.competitionId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <Link href={p.championshipCode ? `/championnats/${p.championshipCode}?saison=${p.season}` : `/competitions/${p.slug}`} className="font-medium underline-offset-2 hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {[seasonLabel(p.season), p.pool && `Zone ${p.pool}`, p.outcome && TEAM_OUTCOME_LABELS[p.outcome]].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["Stade", club.stadium],
                ["Couleurs", club.colors],
                ["Fondation", club.foundedYear],
                ["N° d'affiliation", club.affiliationNumber],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Effectif {seasonLabel(season)}</h2>
            {squad.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun joueur licencié.</p>
            ) : (
              [...POSITIONS, null].map((pos) => {
                const group = squad.filter((p) => p.position === pos);
                return group.length === 0 ? null : (
                  <div key={pos ?? "autre"}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pos ? POSITION_LABELS[pos] : "Poste non renseigné"}</p>
                    <ul className="text-sm">
                      {group.map((p) => (
                        <li key={p.id}>
                          {p.firstName} {p.lastName}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        </aside>
      </div>
    </PublicShell>
  );
}
