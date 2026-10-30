import Link from "next/link";
import { orderStandings, type StandingsRow } from "@/components/competitions/standings-table";
import { ClubLogo } from "@/components/public/club-logo";
import { ArrowCircle, PillLink } from "@/components/public/ui";
import { formatLabel, isLive, MATCH_STATUS_LABELS, type CompetitionType } from "@/lib/competitions";
import { formatDateTime } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import type { MatchRow } from "@/lib/queries/competitions";

const teamName = (c: MatchRow["home"]) => c?.shortName ?? c?.name ?? "À déterminer";

/** Ligne de la liste des matchs : rencontre, compétition, date, flèche. */
function MatchListRow({ row }: { row: MatchRow }) {
  const m = row.match;
  const live = isLive(m.status);
  const played = m.status === "FINISHED" || live;
  return (
    <li>
      <Link
        href={`/matchs/${m.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b py-4 transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green sm:px-2"
      >
        <span className="flex min-w-0 items-center gap-3 font-display text-lg font-semibold uppercase sm:text-xl">
          {row.home && <ClubLogo src={row.home.logo} name={row.home.name} className="size-8 text-xs" />}
          <span className="truncate">{teamName(row.home)}</span>
          {played ? (
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-base text-white tabular-nums ${live ? "bg-[var(--flag-red,#dc241f)]" : "bg-brand-ink"}`}>
              {m.homeScore ?? 0} – {m.awayScore ?? 0}
            </span>
          ) : (
            <span className="shrink-0 text-sm text-muted-foreground">vs</span>
          )}
          <span className="truncate">{teamName(row.away)}</span>
          {row.away && <ClubLogo src={row.away.logo} name={row.away.name} className="size-8 text-xs" />}
        </span>
        <ArrowCircle className="row-span-2" />
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--flag-green)]">{row.competition.name}</span>
          {live ? (
            <span className="text-xs font-bold text-[var(--flag-red,#dc241f)] uppercase">● {MATCH_STATUS_LABELS[m.status]}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{m.kickoffAt ? formatDateTime(m.kickoffAt) : "Date à fixer"}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function MatchList({ title, rows, empty, from = "left", more }: { title: string; rows: MatchRow[]; empty: string; from?: "left" | "right" | "up"; more?: string }) {
  return (
    <div data-reveal={from} className="flex min-w-0 flex-col">
      <h3 className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-2 font-heading text-xl font-bold uppercase">
        {title}
        {more && (
          <Link href={more} className="font-sans text-xs font-semibold normal-case text-[var(--flag-green)] hover:underline">
            Tout voir →
          </Link>
        )}
      </h3>
      {rows.length === 0 ? (
        <p className="border-b py-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <MatchListRow key={r.match.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Classement résumé (8 premiers) : rang, club, matchs joués, différence, points. */
export function MiniStandings({ rows, logos, season, href }: { rows: StandingsRow[]; logos: Map<number, string>; season: number; href: string }) {
  const { ordered } = orderStandings(rows);
  return (
    <div data-reveal="right" className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
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
 * Avant le coup d'envoi de la saison : un seul encart soigné (championnat, saison, clubs engagés, format)
 * au lieu de listes et d'un classement vides.
 */
export function PreSeason({
  competition,
  teams,
  logo,
  href,
}: {
  competition: { name: string; season: number; type: CompetitionType; doubleRound: boolean };
  teams: number;
  logo: string | null;
  href: string;
}) {
  const facts = [
    ["Clubs engagés", String(teams)],
    ["Format", formatLabel(competition, 1)],
    ["Calendrier", "Publication à venir"],
  ] as const;
  return (
    <div data-reveal="up" className="brand-band relative isolate overflow-hidden rounded-2xl p-6 shadow-md sm:p-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel décoratif */}
      <img src="/fecofoot-mark.svg" alt="" aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 -z-10 h-[130%] w-auto opacity-[0.07] select-none" />
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-5">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
            <img src={logo} alt="" className="size-16 shrink-0 rounded-xl bg-white object-contain p-1.5 sm:size-20" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--flag-yellow)] uppercase">Avant-saison · {seasonLabel(competition.season)}</p>
            <h3 className="font-display text-3xl leading-none font-bold uppercase sm:text-5xl">{competition.name}</h3>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
          Les {teams} clubs engagés sont connus. Les résultats, le calendrier des journées et le classement apparaîtront ici dès leur publication par la fédération.
        </p>
        <dl className="grid gap-4 border-t border-white/15 pt-6 sm:grid-cols-3 sm:items-start">
          {facts.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <dt className="text-xs tracking-wider text-white/60 uppercase">{k}</dt>
              <dd className="font-heading text-lg leading-snug font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <PillLink href={href}>Découvrir le championnat</PillLink>
        </div>
      </div>
    </div>
  );
}
