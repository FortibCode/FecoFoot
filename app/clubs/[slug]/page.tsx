import type { Metadata } from "next";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MatchLine } from "@/components/competitions/match-line";
import { PublicShell } from "@/components/public/public-shell";
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
    .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
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
      .where(and(or(eq(matches.homeClubId, club.id), eq(matches.awayClubId, club.id)), eq(matches.status, "FINISHED")))
      .orderBy(desc(matches.kickoffAt))
      .limit(10),
    clubLogos([club.id]),
  ]);

  return (
    <PublicShell eyebrow={`${club.city} · ${row.league}`} title={club.name} wide>
      <div className="mb-8 flex flex-wrap items-center gap-6 rounded-2xl border bg-card p-6 shadow-sm">
        <ClubLogo src={logos.get(club.id)} name={club.name} className="size-28 sm:size-32" />
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {(
            [
              ["Ville", club.city],
              ["Ligue", row.league],
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
            <div className="divide-y rounded-lg border">
              {results.map((m) => (
                <MatchLine key={m.match.id} row={m} href={`/competitions/${m.competition.slug}`} />
              ))}
            </div>
          )}
        </section>
        <aside className="flex flex-col gap-6">
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
