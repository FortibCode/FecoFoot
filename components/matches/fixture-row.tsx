import Link from "next/link";
import { TeamBadge } from "@/components/public/team-badge";
import { ArrowIcon, CalendarIcon, PinIcon, TrophyIcon } from "@/components/public/icons";
import { MatchStatusBadge, type FixtureItem } from "@/components/matches/match-card";
import { kickoffTime } from "@/lib/format";

const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "short", day: "numeric", month: "short" });

/** Nom de l'équipe : sigle sur téléphone quand il existe. */
function Name({ team }: { team: FixtureItem["home"] }) {
  return (
    <span className="line-clamp-2 text-sm leading-tight font-semibold sm:text-base">
      {team.short ? (
        <>
          <span className="sm:hidden">{team.short}</span>
          <span className="hidden sm:inline">{team.name}</span>
        </>
      ) : (
        team.name
      )}
    </span>
  );
}

/** Pastille de statut de la ligne : « À venir » et « Terminé » en vert, les autres statuts comme ailleurs. */
function Status({ item }: { item: FixtureItem }) {
  const pill = "inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap";
  if (item.status === "UPCOMING" && !item.stale) return <span className={`${pill} bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]`}>À venir</span>;
  if (item.status === "FINISHED" && !item.awaiting) return <span className={`${pill} bg-[var(--flag-green)] text-white`}>Terminé</span>;
  return <MatchStatusBadge item={item} />;
}

/**
 * Carte de match de la page Matchs : compétition (si la liste en mélange plusieurs), journée et statut,
 * les deux équipes face à face, au centre l'heure et la date (ou le score validé), le stade dessous.
 * Toute la carte mène à la fiche du match.
 */
export function FixtureRow({ item, showCompetition = false }: { item: FixtureItem; showCompetition?: boolean }) {
  const showScore = item.score && !item.awaiting && (item.status === "LIVE" || item.status === "FINISHED" || item.status === "SUSPENDED");
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  const date = item.kickoffAt ? day.format(item.kickoffAt) : "Date à fixer";
  const clubs = [item.home.id, item.away.id].filter(Boolean).join(" ");
  return (
    <li data-clubs={clubs || undefined}>
      <Link
        href={item.href}
        className="group flex flex-col gap-3 bg-muted/60 px-4 py-4 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green sm:px-5"
      >
        <span className="flex flex-wrap items-center gap-2">
          {showCompetition && (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs font-semibold">
              <TrophyIcon className="size-3.5 text-[var(--flag-green)]" />
              <span className="truncate">{item.group.title}</span>
            </span>
          )}
          {item.group.detail && <span className="rounded-full bg-card px-2.5 py-0.5 text-[0.7rem] font-semibold">{item.group.detail}</span>}
          <Status item={item} />
        </span>
        <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9.5rem_minmax(0,1fr)_2.5rem] sm:gap-4">
          <span className="flex min-w-0 flex-col-reverse items-center gap-2 text-center sm:flex-row sm:justify-end sm:gap-3 sm:text-right">
            <Name team={item.home} />
            <TeamBadge name={item.home.name} logo={item.home.logo} flag={item.home.flag} size="md" />
          </span>

          <span className="flex flex-col items-center gap-1 text-center sm:border-x sm:px-2">
            {showScore ? (
              <>
                <span className={`bg-card px-3 py-1 font-display text-xl leading-none font-bold tabular-nums sm:text-2xl ${item.status === "LIVE" ? "text-[var(--flag-red)]" : ""}`}>
                  {item.score![0]} - {item.score![1]}
                </span>
                {item.penalties && <span className="text-[0.65rem] text-muted-foreground">t.a.b. {item.penalties[0]}-{item.penalties[1]}</span>}
                <span className="inline-flex items-center gap-1 text-[0.7rem] whitespace-nowrap text-muted-foreground capitalize">
                  <CalendarIcon className="size-3" />
                  {date}
                  {time && ` · ${time}`}
                </span>
              </>
            ) : (
              <>
                <span className="font-display text-lg leading-none font-bold tabular-nums sm:text-xl">{time ?? "—"}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground capitalize">{date}</span>
              </>
            )}
          </span>

          <span className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
            <TeamBadge name={item.away.name} logo={item.away.logo} flag={item.away.flag} size="md" />
            <Name team={item.away} />
          </span>

          <span aria-hidden className="hidden size-9 place-items-center rounded-full bg-card text-foreground transition-colors group-hover:bg-[var(--flag-green)] group-hover:text-white sm:grid">
            <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
        {item.venue && (
          <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-xs text-muted-foreground sm:pr-14">
            <PinIcon className="size-3.5" />
            <span className="truncate">{item.venue}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

/** Prochain rendez-vous (colonne latérale) : journée, équipes face à face, date, heure et stade. */
export function NextFixture({ item }: { item: FixtureItem }) {
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  return (
    <li>
      <Link href={item.href} className="flex flex-col gap-3 bg-card p-4 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green">
        <span className="flex flex-wrap items-center gap-2">
          {item.group.detail && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.7rem] font-semibold">{item.group.detail}</span>}
          <Status item={item} />
        </span>
        <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <span className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <TeamBadge name={item.home.name} logo={item.home.logo} flag={item.home.flag} size="sm" />
            <span className="line-clamp-2 text-xs leading-tight font-semibold">{item.home.short ?? item.home.name}</span>
          </span>
          <span className="bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">VS</span>
          <span className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <TeamBadge name={item.away.name} logo={item.away.logo} flag={item.away.flag} size="sm" />
            <span className="line-clamp-2 text-xs leading-tight font-semibold">{item.away.short ?? item.away.name}</span>
          </span>
        </span>
        <span className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 capitalize">
            <CalendarIcon className="size-3.5" />
            {item.kickoffAt ? day.format(item.kickoffAt) : "Date à fixer"}
            {time && ` · ${time}`}
          </span>
          {item.venue && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PinIcon className="size-3.5" />
              <span className="truncate">{item.venue}</span>
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
