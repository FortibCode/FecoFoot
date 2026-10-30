import Link from "next/link";
import { orderStandings, type StandingsRow } from "@/components/competitions/standings-table";
import { ClubLogo } from "@/components/public/club-logo";
import { formatLabel, type CompetitionType } from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import { ArrowIcon, BallIcon, TrophyIcon } from "@/components/public/icons";

/** Classement résumé (8 premiers) : rang, club, matchs joués, différence, points. */
export function MiniStandings({ rows, logos, season, href }: { rows: StandingsRow[]; logos: Map<number, string>; season: number; href: string }) {
  const { ordered } = orderStandings(rows);
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-muted/60">
      <div className="flex items-baseline justify-between gap-3 bg-brand-ink px-4 py-3 text-white">
        <h3 className="font-heading text-lg font-bold uppercase">Classement</h3>
        <span className="text-xs text-white/70">Saison {seasonLabel(season)}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="w-10 py-2 text-center font-semibold">
              <abbr title="Rang" className="no-underline">#</abbr>
            </th>
            <th scope="col" className="py-2 text-left font-semibold">Club</th>
            <th scope="col" className="w-9 py-2 text-center font-semibold">
              <abbr title="Matchs joués" className="no-underline">J</abbr>
            </th>
            <th scope="col" className="w-11 py-2 text-center font-semibold">
              <abbr title="Différence de buts" className="no-underline">Diff</abbr>
            </th>
            <th scope="col" className="w-12 py-2 pr-3 text-center font-semibold">
              <abbr title="Points" className="no-underline">Pts</abbr>
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ordered.slice(0, 8).map((r, i) => (
            <tr key={r.clubId} className="border-b last:border-b-0">
              <td className="py-2.5 text-center font-semibold">{i + 1}</td>
              <td className="py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <ClubLogo src={logos.get(r.clubId)} name={r.name} className="size-6 text-[0.6rem]" />
                  <span className="truncate font-medium">{r.shortName ?? r.name}</span>
                </span>
              </td>
              <td className="py-2.5 text-center text-muted-foreground">{r.played}</td>
              <td className="py-2.5 text-center text-muted-foreground">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="py-2.5 pr-3 text-center font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href={href} className="group mt-auto flex items-center justify-between border-t px-4 py-3 text-sm font-semibold hover:bg-muted">
        Classement complet
        <span aria-hidden className="text-[var(--flag-green)] transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </div>
  );
}

/**
 * Avant le coup d'envoi de la saison : le championnat tel qu'il est enregistré — ses clubs engagés (logos,
 * accès à leur fiche), son format et l'état du calendrier — au lieu de listes et d'un classement vides.
 */
export function PreSeason({
  competition,
  clubs,
  logos,
  logo,
  href,
}: {
  competition: { name: string; season: number; type: CompetitionType; doubleRound: boolean };
  clubs: { id: number; name: string; shortName: string | null; slug: string }[];
  logos: Map<number, string>;
  logo: string | null;
  href: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-muted/60">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
            <img src={logo} alt="" className="size-14 shrink-0 rounded-lg border bg-white object-contain p-1" />
          )}
          <div className="min-w-0">
            <h3 className="font-display text-2xl leading-tight font-bold uppercase sm:text-3xl">{competition.name}</h3>
            <p className="text-sm text-muted-foreground">
              Saison {seasonLabel(competition.season)} · {formatLabel(competition, 1)}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
          <span aria-hidden className="size-2 rounded-full bg-[var(--flag-yellow)]" />
          Calendrier non publié
        </span>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        <p className="text-sm font-semibold">{clubs.length} clubs engagés</p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {clubs.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clubs/${c.slug}`}
                title={c.name}
                className="flex h-full flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:border-flag-green/50 sm:p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green shadow-sm"
              >
                <ClubLogo src={logos.get(c.id)} name={c.name} className="size-11 text-xs" />
                <span className="line-clamp-2 text-xs leading-tight font-medium">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm sm:px-6">
        <p className="text-muted-foreground">Les journées, les résultats et le classement s&apos;afficheront ici dès la publication du calendrier.</p>
        <Link href={href} className="group inline-flex items-center gap-1.5 font-semibold text-flag-green">
          Page du championnat
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Classement de la colonne latérale (page Matchs) : position, club, bilan et points, accès au classement
 * complet. Avant la première journée, les clubs engagés par ordre alphabétique, avec la mention.
 */
export function SideStandings({ rows, logos, href }: { rows: StandingsRow[]; logos: Map<number, string>; href: string }) {
  const { ordered, started } = orderStandings(rows);
  const cols = [
    ["J", "Matchs joués", (r: StandingsRow) => r.played],
    ["G", "Victoires", (r: StandingsRow) => r.won],
    ["N", "Nuls", (r: StandingsRow) => r.drawn],
    ["P", "Défaites", (r: StandingsRow) => r.lost],
    ["Diff", "Différence de buts", (r: StandingsRow) => (r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff)],
  ] as const;
  return (
    <section aria-labelledby="side-standings" className="flex flex-col gap-4 bg-muted/60 p-4 sm:p-5">
      <h2 id="side-standings" className="flex items-center gap-2.5 font-heading text-lg font-bold uppercase">
        <TrophyIcon className="size-5 text-[var(--flag-green)]" />
        Classement
      </h2>
      {!started && <p className="text-xs text-muted-foreground">Avant la première journée : clubs engagés par ordre alphabétique.</p>}
      <table className="w-full bg-card text-sm">
        <thead className="bg-muted/60 text-[0.7rem] text-muted-foreground">
          <tr>
            <th scope="col" className="w-9 py-2.5 text-center font-semibold">
              <abbr title="Position" className="no-underline">Pos</abbr>
            </th>
            <th scope="col" className="py-2.5 text-left font-semibold">Club</th>
            {cols.map(([k, title]) => (
              <th key={k} scope="col" className="w-7 py-2.5 text-center font-semibold">
                <abbr title={title} className="no-underline">{k}</abbr>
              </th>
            ))}
            <th scope="col" className="w-9 py-2.5 pr-1.5 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {ordered.slice(0, 8).map((r, i) => (
            <tr key={r.clubId} className="border-t">
              <td className="py-2.5 text-center font-semibold">{started ? i + 1 : "–"}</td>
              <td className="py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <ClubLogo src={logos.get(r.clubId)} name={r.name} className="size-6 text-[0.55rem]" />
                  <span className="truncate font-medium">{r.shortName ?? r.name}</span>
                </span>
              </td>
              {cols.map(([k, , get]) => (
                <td key={k} className="py-2.5 text-center text-xs text-muted-foreground">{get(r)}</td>
              ))}
              <td className="py-2.5 pr-1.5 text-center font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href={href} className="group inline-flex items-center gap-1.5 self-start text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
        Voir le classement complet
        <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

/** Meilleurs buteurs (buts des matchs validés), colonne latérale de la page Matchs. */
export function SideScorers({ scorers }: { scorers: { playerId: number; goals: number; player?: { firstName: string; lastName: string; club: string | null } }[] }) {
  return (
    <section aria-labelledby="side-scorers" className="flex flex-col gap-4 bg-muted/60 p-4 sm:p-5">
      <h2 id="side-scorers" className="flex items-center gap-2.5 font-heading text-lg font-bold uppercase">
        <BallIcon className="size-5 text-[var(--flag-green)]" />
        Meilleurs buteurs
      </h2>
      <ol className="flex flex-col bg-card">
        {scorers.slice(0, 5).map((s, i) => (
          <li key={s.playerId} className="flex items-center gap-3 border-t px-3 py-2.5 text-sm first:border-t-0">
            <span className="w-4 text-center font-semibold tabular-nums">{i + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{s.player ? `${s.player.firstName} ${s.player.lastName}` : "Joueur"}</span>
              {s.player?.club && <span className="truncate text-xs text-muted-foreground">{s.player.club}</span>}
            </span>
            <span className="font-bold tabular-nums">
              {s.goals} <span className="text-xs font-normal text-muted-foreground">but{s.goals > 1 ? "s" : ""}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
