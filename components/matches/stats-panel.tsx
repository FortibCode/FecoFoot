import { CompareStats } from "@/components/matches/form-rows";
import { MatchTabs } from "@/components/matches/match-tabs";
import { statRows, type EventType, type MatchStatValues } from "@/lib/competitions";
import { STAT_PERIOD_LABELS, STAT_PERIODS, type StatPeriod } from "@/lib/match-stats";

/** Statistiques relevées du match (total, puis mi-temps si elles ont été saisies), barres comparées. */
export function StatsPanel({ stats }: { stats: Partial<Record<StatPeriod, MatchStatValues>> }) {
  const periods = STAT_PERIODS.filter((p) => stats[p] && statRows(stats[p]!).length > 0);
  if (periods.length === 0) return null;
  const table = (p: StatPeriod) => (
    <CompareStats
      rows={statRows(stats[p]!).map((r) => ({ label: r.label, home: r.percent ? `${r.home} %` : r.home, away: r.percent ? `${r.away} %` : r.away, homeN: r.home, awayN: r.away }))}
    />
  );
  return periods.length === 1 ? table(periods[0]) : <MatchTabs label="Période des statistiques" initial={periods[0]} tabs={periods.map((p) => ({ id: p, label: STAT_PERIOD_LABELS[p], panel: table(p) }))} />;
}

export type TimelineEvent = { id: number; minute: number; type: EventType; home: boolean; player: string; second?: string | null };

function Icon({ type }: { type: EventType }) {
  if (type === "YELLOW_CARD" || type === "RED_CARD")
    return <span aria-hidden className={`inline-block h-4 w-3 shrink-0 rounded-[2px] ${type === "YELLOW_CARD" ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-red)]"}`} />;
  if (type === "SUBSTITUTION")
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-flag-green" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h9l-2.5-2.5M13 11H4l2.5 2.5" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`size-4 shrink-0 ${type === "OWN_GOAL" ? "text-[var(--flag-red)]" : ""}`}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.5 10.9 6.6 9.8 10H6.2L5.1 6.6Z" fill="var(--background)" />
    </svg>
  );
}

const LABELS: Record<EventType, string> = {
  GOAL: "But",
  PENALTY_GOAL: "But sur penalty",
  OWN_GOAL: "But contre son camp",
  YELLOW_CARD: "Carton jaune",
  RED_CARD: "Carton rouge",
  SUBSTITUTION: "Changement",
};

/** Chronologie : équipe à domicile à gauche, extérieur à droite, minute au centre. */
export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col divide-y rounded-2xl border bg-card text-sm">
      {events.map((e) => {
        const who = (
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{e.player}</span>
            <span className="text-xs text-muted-foreground">
              {LABELS[e.type]}
              {e.second && (e.type === "SUBSTITUTION" ? ` · entre ${e.second}` : ` · passe de ${e.second}`)}
            </span>
          </span>
        );
        return (
          <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:px-4">
            <span className="flex items-center justify-end gap-2 text-right">
              {e.home && (
                <>
                  {who}
                  <Icon type={e.type} />
                </>
              )}
            </span>
            <span className="justify-self-center rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">{e.minute}&apos;</span>
            <span className="flex items-center gap-2">
              {!e.home && (
                <>
                  <Icon type={e.type} />
                  {who}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
