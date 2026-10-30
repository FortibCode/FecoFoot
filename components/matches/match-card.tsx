import Link from "next/link";
import { ClubLogo } from "@/components/public/club-logo";
import { ArrowCircle } from "@/components/public/ui";
import { LiveMinute } from "@/components/matches/live-minute";
import { liveMinute, PUBLIC_MATCH_STATUS_LABELS, type MatchPeriod, type PublicMatchStatus } from "@/lib/competitions";
import { kickoffTime } from "@/lib/format";

const shortDay = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "numeric", month: "short" });

/** Une rencontre telle que l'affiche le portail : match de club ou des sélections nationales. */
export type FixtureItem = {
  key: string;
  href: string;
  kickoffAt: Date | null;
  venue: string | null;
  status: PublicMatchStatus;
  /** Terminé mais pas encore validé par l'organisateur : score masqué. */
  awaiting: boolean;
  /** Encore « programmé » plus de 3 h après le coup d'envoi : le résultat n'a pas été saisi. */
  stale?: boolean;
  halfTime: boolean;
  period: MatchPeriod | null;
  periodStartedAt: Date | null;
  /** `short` : nom court affiché sur téléphone (sigle du club). */
  home: { name: string; short?: string | null; logo?: string | null; flag?: string | null };
  away: { name: string; short?: string | null; logo?: string | null; flag?: string | null };
  score: [number, number] | null;
  penalties: [number, number] | null;
  /** Regroupement : compétition et journée / tour. */
  group: { key: string; title: string; detail: string | null; href: string | null };
};

/** Pastille de statut : libellé toujours écrit (jamais la couleur seule). */
export function MatchStatusBadge({ item, size = "sm" }: { item: FixtureItem; size?: "sm" | "lg" }) {
  const pad = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[0.7rem]";
  if (item.status === "LIVE") {
    const start = item.periodStartedAt?.toISOString() ?? null;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--flag-red)] font-bold whitespace-nowrap text-white ${pad}`}>
        <span aria-hidden className="size-1.5 rounded-full bg-white motion-safe:animate-pulse" />
        <span className="sr-only">En direct, </span>
        {item.halfTime ? "Mi-temps" : <LiveMinute period={item.period} startedAt={start} initial={liveMinute(item.period, item.periodStartedAt)} fallback="En direct" />}
      </span>
    );
  }
  if (item.status === "UPCOMING")
    return item.stale ? <span className={`inline-flex rounded-full bg-muted font-semibold whitespace-nowrap text-muted-foreground ${pad}`}>Résultat non publié</span> : null;
  const tone = {
    FINISHED: "bg-muted text-muted-foreground",
    POSTPONED: "bg-[color-mix(in_srgb,var(--flag-yellow)_30%,transparent)] text-foreground",
    SUSPENDED: "bg-[color-mix(in_srgb,var(--flag-red)_14%,transparent)] text-foreground",
    CANCELLED: "bg-muted text-muted-foreground line-through",
  }[item.status];
  return <span className={`inline-flex rounded-full font-semibold whitespace-nowrap ${pad} ${tone}`}>{item.awaiting ? "En attente" : PUBLIC_MATCH_STATUS_LABELS[item.status]}</span>;
}

function Side({ team, align }: { team: FixtureItem["home"]; align: "end" | "start" }) {
  const mark = team.flag ? (
    // eslint-disable-next-line @next/next/no-img-element -- petit SVG statique
    <img src={team.flag} alt="" className="h-5 w-7 shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 sm:h-6 sm:w-9" />
  ) : (
    <ClubLogo src={team.logo} name={team.name} className="size-7 text-[0.6rem] sm:size-9 sm:text-xs" />
  );
  return (
    <span className={`flex min-w-0 items-center gap-2 sm:gap-3 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      {mark}
      <span className="truncate font-display text-[0.95rem] leading-tight font-bold uppercase sm:text-lg">
        {team.short ? (
          <>
            <span className="sm:hidden">{team.short}</span>
            <span className="hidden sm:inline">{team.name}</span>
          </>
        ) : (
          team.name
        )}
      </span>
    </span>
  );
}

/**
 * Ligne de match : heure ou statut, équipes de part et d'autre du score, stade. Toute la ligne mène à la fiche.
 * Le score n'est montré qu'en direct (saisie officielle) ou une fois le résultat validé.
 */
export function MatchCard({ item, showDate = false }: { item: FixtureItem; showDate?: boolean }) {
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  const showScore = item.score && !item.awaiting && (item.status === "LIVE" || item.status === "FINISHED" || item.status === "SUSPENDED");
  return (
    <li>
      <Link
        href={item.href}
        className={`group grid grid-cols-[4.25rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-3 py-3.5 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green sm:gap-x-4 sm:px-5 ${showDate ? "sm:grid-cols-[5rem_minmax(0,1fr)_auto_minmax(0,1fr)]" : "sm:grid-cols-[7.5rem_minmax(0,1fr)_auto_minmax(0,1fr)_2.25rem]"}`}
      >
        <span className="flex flex-col items-start gap-1">
          {/* Liste toutes dates confondues (page d'accueil) : le jour avant l'heure. */}
          {showDate && item.kickoffAt && <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">{shortDay.format(item.kickoffAt)}</span>}
          {(item.status === "UPCOMING" && !item.stale) || item.status === "POSTPONED" ? (
            <span className="font-heading text-sm font-bold tabular-nums">{time ?? "—"}</span>
          ) : null}
          <MatchStatusBadge item={item} />
        </span>
        <Side team={item.home} align="end" />
        <span className="flex flex-col items-center">
          {showScore ? (
            <span className={`rounded-md px-2.5 py-1 font-heading text-base font-bold whitespace-nowrap text-white tabular-nums sm:text-lg ${item.status === "LIVE" ? "bg-[var(--flag-red)]" : "bg-brand-ink"}`}>
              {item.score![0]} - {item.score![1]}
            </span>
          ) : (
            <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">VS</span>
          )}
          {showScore && item.penalties && (
            <span className="mt-0.5 text-[0.65rem] whitespace-nowrap text-muted-foreground">
              t.a.b. {item.penalties[0]}-{item.penalties[1]}
            </span>
          )}
        </span>
        <Side team={item.away} align="start" />
        {/* Vue compacte (accueil, en colonnes) : pas de flèche, toute la ligne reste un lien. */}
        {!showDate && (
          <span className="hidden sm:block">
            <ArrowCircle />
          </span>
        )}
        {item.venue && <span className="col-start-2 col-end-5 truncate text-center text-xs text-muted-foreground">{item.venue}</span>}
      </Link>
    </li>
  );
}
