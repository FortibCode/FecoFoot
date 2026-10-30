import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchLine } from "@/components/competitions/match-line";
import { PaginatedStandings } from "@/components/competitions/paginated-standings";
import { ClubLogo } from "@/components/public/club-logo";
import { PublicShell } from "@/components/public/public-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { clubLogos } from "@/lib/club-logos";
import { COMPETITION_CATEGORY_LABELS, isLive, publicStatusLabel } from "@/lib/competitions";
import { leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { competitionTables } from "@/lib/queries/competitions";
import { leagueDetail } from "@/lib/queries/public-leagues";

export async function generateMetadata({ params }: PageProps<"/ligues/[code]">): Promise<Metadata> {
  const data = await leagueDetail((await params).code);
  return data
    ? { title: `${data.league.name} — FECOFOOT`, description: `Clubs, compétitions, calendrier, résultats et classements — ${data.league.name}.` }
    : {};
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</p>;
}

/** Fiche publique d'une ligue départementale : présentation, clubs, compétitions, matchs et classements. */
export default async function PublicLeaguePage({ params }: PageProps<"/ligues/[code]">) {
  const data = await leagueDetail((await params).code);
  if (!data) notFound();
  const { league, clubs, competitions, upcoming, results } = data;
  // Classements : championnats en cours (ou terminés) de la saison la plus récente.
  const latest = competitions[0]?.season;
  const championships = competitions.filter((c) => c.type === "LEAGUE" && c.season === latest);
  const tables = (await Promise.all(championships.map((c) => competitionTables(c.id)))).filter((t) => t !== null);
  const logos = await clubLogos([...clubs.map((c) => c.id), ...tables.flatMap((t) => t.tables.flatMap((p) => p.rows.map((r) => r.clubId)))]);
  const logo = leagueLogoUrl(league);
  const contacts = [
    ["Département", league.department],
    ["Président", league.president],
    ["E-mail", league.email],
    ["Téléphone", league.phone],
  ].filter((c): c is [string, string] => Boolean(c[1]));

  return (
    <PublicShell eyebrow="Ligues" title={league.name} subtitle={league.department ? `Département : ${league.department}` : undefined} wide>
      <div className="flex flex-col gap-10">
        <section className="flex flex-wrap items-start gap-6 rounded-2xl bg-muted/60 p-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`Logo — ${league.name}`} className="size-24 rounded-xl bg-white object-contain p-1 shadow-sm" />
          ) : (
            <span className="grid size-24 place-items-center rounded-xl bg-brand-ink font-heading text-2xl font-bold text-[#fbde4a]">{league.code}</span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {league.description ? (
              <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed">{league.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">La présentation de la ligue n&apos;a pas encore été publiée.</p>
            )}
            {contacts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
                {contacts.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="truncate font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-lg font-bold">Matchs à venir</h2>
            {upcoming.some((m) => isLive(m.match.status)) && <LiveRefresh />}
            {upcoming.length === 0 ? (
              <Empty>Aucun match programmé.</Empty>
            ) : (
              <div className="divide-y overflow-hidden rounded-lg bg-muted/60">
                {upcoming.map((m) => (
                  <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
                ))}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-lg font-bold">Résultats récents</h2>
            {results.length === 0 ? (
              <Empty>Aucun résultat officiel pour le moment.</Empty>
            ) : (
              <div className="divide-y overflow-hidden rounded-lg bg-muted/60">
                {results.map((m) => (
                  <MatchLine key={m.match.id} row={m} href={`/matchs/${m.match.id}`} official />
                ))}
              </div>
            )}
          </div>
        </section>

        {tables.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">Classements</h2>
            {tables.map((t) =>
              t.tables.map((p) => (
                <PaginatedStandings
                  key={`${t.competition.id}-${p.pool}`}
                  rows={p.rows}
                  title={p.pool ? `${t.competition.name} — Poule ${p.pool}` : t.competition.name}
                  logos={Object.fromEntries(logos)}
                />
              )),
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Compétitions organisées</h2>
          {competitions.length === 0 ? (
            <Empty>Aucune compétition publiée par cette ligue.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {competitions.map((c) => (
                <li key={c.id}>
                  <Link href={`/competitions/${c.slug}`} className="block rounded-lg bg-muted/60 p-4 transition-colors hover:bg-muted">
                    <p className="text-xs text-muted-foreground">
                      {seasonLabel(c.season)} · {COMPETITION_CATEGORY_LABELS[c.category]}
                      {c.gender === "F" ? " · Féminin" : ""}
                    </p>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{publicStatusLabel(c.status, c.played)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Clubs affiliés · {clubs.length}</h2>
          {clubs.length === 0 ? (
            <Empty>Aucun club affilié à cette ligue pour le moment.</Empty>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {clubs.map((c) => (
                <li key={c.id}>
                  <Link href={`/clubs/${c.slug}`} className="flex h-full flex-col items-center gap-2 rounded-xl bg-muted/60 p-4 text-center transition-all motion-safe:hover:-translate-y-0.5">
                    <ClubLogo src={logos.get(c.id)} name={c.name} className="size-16" />
                    <span className="font-display leading-tight font-bold uppercase">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
