import Link from "next/link";
import { TeamBadge } from "@/components/public/team-badge";
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
  home: { id?: number; name: string; short?: string | null; logo?: string | null; flag?: string | null };
  away: { id?: number; name: string; short?: string | null; logo?: string | null; flag?: string | null };
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

/** Une équipe sur sa ligne : logo ou drapeau, nom (nom court sur téléphone), repère « club suivi ». */
function TeamRow({ team, tone }: { team: FixtureItem["home"]; tone: "win" | "lose" | "neutral" }) {
  const mark = <TeamBadge name={team.name} logo={team.logo} flag={team.flag} size="xs" />;
  return (
    <span className={`flex min-w-0 items-center gap-2.5 text-[0.95rem] leading-tight ${tone === "win" ? "font-bold" : tone === "lose" ? "text-muted-foreground" : "font-medium"}`}>
      {mark}
      <span className="truncate">
        {team.short ? (
          <>
            <span className="sm:hidden">{team.short}</span>
            <span className="hidden sm:inline">{team.name}</span>
          </>
        ) : (
          team.name
        )}
      </span>
      {/* Club suivi par le visiteur : étoile affichée par la feuille de style des favoris. */}
      {team.id && (
        <span data-fav-mark={team.id} aria-hidden className="hidden text-xs text-[var(--flag-yellow)]">
          ★
        </span>
      )}
    </span>
  );
}

/** Heure, minute ou statut dans la colonne de gauche (le statut est toujours écrit). */
function StatusText({ item }: { item: FixtureItem }) {
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  if (item.status === "LIVE") {
    return (
      <span className="font-bold text-[var(--flag-red)]">
        <span className="sr-only">En direct, </span>
        {item.halfTime ? (
          "MT"
        ) : (
          <LiveMinute period={item.period} startedAt={item.periodStartedAt?.toISOString() ?? null} initial={liveMinute(item.period, item.periodStartedAt)} fallback="Direct" />
        )}
      </span>
    );
  }
  if (item.status === "UPCOMING") return item.stale ? <span className="text-muted-foreground">Non publié</span> : <span className="font-semibold tabular-nums">{time ?? "—"}</span>;
  if (item.status === "FINISHED") return <span className="text-muted-foreground">{item.awaiting ? "Attente" : "Terminé"}</span>;
  const tone = { POSTPONED: "text-foreground font-semibold", SUSPENDED: "text-[var(--flag-red)] font-semibold", CANCELLED: "text-muted-foreground line-through" }[item.status];
  return <span className={tone}>{PUBLIC_MATCH_STATUS_LABELS[item.status]}</span>;
}

/**
 * Ligne de match compacte : heure ou minute à gauche, les deux équipes l'une sous l'autre, le score
 * aligné à droite (vainqueur en gras). Toute la ligne mène à la fiche. Le score n'est montré qu'en direct
 * (saisie officielle) ou une fois le résultat validé.
 */
export function MatchCard({ item, showDate = false }: { item: FixtureItem; showDate?: boolean }) {
  const showScore = item.score && !item.awaiting && (item.status === "LIVE" || item.status === "FINISHED" || item.status === "SUSPENDED");
  const live = item.status === "LIVE";
  const [h, a] = item.score ?? [0, 0];
  const decided = showScore && item.status === "FINISHED" && (h !== a || item.penalties);
  const homeWins = h > a || (h === a && !!item.penalties && item.penalties[0] > item.penalties[1]);
  const tone = (home: boolean) => (!decided ? "neutral" : home === homeWins ? "win" : "lose");
  const clubs = [item.home.id, item.away.id].filter(Boolean).join(" ");
  return (
    <li data-clubs={clubs || undefined}>
      <Link
        href={item.href}
        className="group grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green sm:grid-cols-[4.75rem_minmax(0,1fr)_auto_1rem] sm:px-5"
      >
        <span className="flex flex-col items-center gap-0.5 border-r pr-3 text-center text-xs">
          {showDate && item.kickoffAt && <span className="whitespace-nowrap text-muted-foreground">{shortDay.format(item.kickoffAt)}</span>}
          <StatusText item={item} />
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <TeamRow team={item.home} tone={tone(true)} />
          <TeamRow team={item.away} tone={tone(false)} />
          {item.venue && !showDate && <span className="hidden truncate text-xs text-muted-foreground sm:block">{item.venue}</span>}
        </span>
        <span className={`flex flex-col items-end gap-1.5 text-[0.95rem] leading-tight tabular-nums ${live ? "font-bold text-[var(--flag-red)]" : ""}`}>
          {showScore ? (
            ([0, 1] as const).map((k) => (
              <span key={k} className={`flex items-baseline gap-1 ${!live && tone(k === 0) === "win" ? "font-bold" : !live && tone(k === 0) === "lose" ? "text-muted-foreground" : "font-semibold"}`}>
                {item.penalties && <span className="text-[0.7rem] font-normal text-muted-foreground">({item.penalties[k]})</span>}
                {item.score![k]}
              </span>
            ))
          ) : (
            <span className="sr-only">Score à venir</span>
          )}
        </span>
        <span aria-hidden className="hidden text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block">
          ›
        </span>
      </Link>
    </li>
  );
}
