import Link from "next/link";
import { TeamBadge } from "@/components/public/team-badge";
import { ArrowIcon, CalendarIcon, ClockIcon, PinIcon, TrophyIcon } from "@/components/public/icons";
import { MatchStatusBadge, type FixtureItem } from "@/components/matches/match-card";
import { kickoffTime } from "@/lib/format";

const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "short", day: "numeric", month: "short" });

function Team({ team }: { team: FixtureItem["home"] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <TeamBadge name={team.name} logo={team.logo} flag={team.flag} size="md" />
      <span className="line-clamp-2 text-sm leading-tight font-semibold">
        {team.short ? (
          <>
            <span className="sm:hidden">{team.short}</span>
            <span className="hidden sm:inline">{team.name}</span>
          </>
        ) : (
          team.name
        )}
      </span>
      {team.id && (
        <span data-fav-mark={team.id} aria-hidden className="hidden text-xs text-[var(--flag-yellow)]">
          ★
        </span>
      )}
    </span>
  );
}

/**
 * Carte de match de l'accueil : compétition, date et heure, les deux équipes face à face (« VS » ou
 * score validé), le stade et une flèche vers la fiche. Toute la carte mène à la fiche du match.
 */
export function HomeMatchCard({ item }: { item: FixtureItem }) {
  const showScore = item.score && !item.awaiting && (item.status === "LIVE" || item.status === "FINISHED" || item.status === "SUSPENDED");
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  const done = item.status === "FINISHED" && !item.awaiting;
  const clubs = [item.home.id, item.away.id].filter(Boolean).join(" ");
  return (
    <li data-clubs={clubs || undefined}>
      <Link
        href={item.href}
        className="group flex flex-col gap-4 bg-card p-4 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green sm:p-5"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
            <TrophyIcon className="size-3.5 text-[var(--flag-green)]" />
            <span className="truncate">
              {item.group.title}
              {item.group.detail && <span className="font-normal text-muted-foreground"> · {item.group.detail}</span>}
            </span>
          </span>
          {done ? (
            <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--flag-green)]">Terminé</span>
          ) : (
            <MatchStatusBadge item={item} />
          )}
        </span>

        <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:gap-5">
          {/* Date et heure : colonne à gauche sur grand écran, ligne au-dessus sur téléphone. */}
          <span className="col-span-2 flex items-center justify-center gap-4 text-xs text-muted-foreground sm:col-span-1 sm:flex-col sm:items-start sm:gap-2 sm:border-r sm:pr-4">
            {item.kickoffAt && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap capitalize">
                <CalendarIcon className="size-4 text-foreground" />
                {day.format(item.kickoffAt)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap text-foreground tabular-nums">
              <ClockIcon className="size-4" />
              {time ?? "Heure à confirmer"}
            </span>
          </span>

          <span className="flex min-w-0 flex-col gap-3">
            <span className="flex items-start justify-center gap-2 sm:gap-4">
              <Team team={item.home} />
              <span className={`mt-1.5 grid min-w-14 place-items-center bg-muted px-2.5 py-2 font-display text-lg leading-none font-bold tabular-nums ${item.status === "LIVE" ? "text-[var(--flag-red)]" : ""}`}>
                {showScore ? (
                  <span>
                    {item.score![0]} - {item.score![1]}
                    {item.penalties && <span className="block pt-1 text-center text-[0.65rem] font-normal text-muted-foreground">t.a.b. {item.penalties[0]}-{item.penalties[1]}</span>}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">VS</span>
                )}
              </span>
              <Team team={item.away} />
            </span>
            {item.venue && (
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <PinIcon className="size-3.5" />
                <span className="truncate">{item.venue}</span>
              </span>
            )}
          </span>

          <span aria-hidden className="hidden size-10 place-items-center rounded-full bg-muted text-foreground transition-colors group-hover:bg-[var(--flag-green)] group-hover:text-white sm:grid">
            <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </li>
  );
}
