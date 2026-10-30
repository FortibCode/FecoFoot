import Link from "next/link";
import { TeamBadge } from "@/components/public/team-badge";
import { MatchStatusBadge, type FixtureItem } from "@/components/matches/match-card";
import { formatDayMonth, kickoffTime } from "@/lib/format";

function Team({ team }: { team: FixtureItem["home"] }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-2.5 text-center">
      <TeamBadge name={team.name} logo={team.logo} flag={team.flag} size="lg" className="shadow-md" />
      <span className="line-clamp-2 font-display text-base leading-tight font-bold uppercase sm:text-xl">{team.name}</span>
    </span>
  );
}

/** Affiche d'un match « À la une » : date en bandeau, compétition, équipes, score ou heure, stade. */
export function FeaturedMatch({ item, index = 0 }: { item: FixtureItem; index?: number }) {
  const time = item.kickoffAt ? kickoffTime(item.kickoffAt) : null;
  const live = item.status === "LIVE";
  return (
    <li data-reveal="up" style={{ ["--rd" as string]: `${index * 110}ms` }} className="min-w-0">
      <Link
        href={item.href}
        className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-brand-ink text-white shadow-md transition-[box-shadow,transform] duration-300 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-1"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dessin vectoriel décoratif */}
        <img src="/fecofoot-mark.svg" alt="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-12 -z-10 h-[120%] w-auto opacity-[0.06] select-none" />
        <div className="flex items-center gap-3">
          <span className="shrink-0 bg-[var(--flag-red)] py-2 pr-6 pl-4 font-display text-lg font-bold whitespace-nowrap uppercase [clip-path:polygon(0_0,100%_0,calc(100%-0.75rem)_100%,0_100%)]">
            {item.kickoffAt ? formatDayMonth(item.kickoffAt) : "Date à fixer"}
          </span>
          <span className="line-clamp-2 min-w-0 pr-4 text-xs leading-snug font-semibold tracking-[0.12em] text-[var(--flag-yellow)] uppercase">
            {item.group.title}
            {item.group.detail && <span className="text-white/60"> · {item.group.detail}</span>}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 pt-6 pb-4 sm:px-6">
          <Team team={item.home} />
          <span className="flex flex-col items-center gap-2">
            {live && <MatchStatusBadge item={item} />}
            {item.score && live ? (
              <span className="rounded-lg bg-[var(--flag-red)] px-3 py-1 font-display text-3xl font-bold tabular-nums">
                {item.score[0]} - {item.score[1]}
              </span>
            ) : (
              <span className="rounded bg-[var(--flag-yellow)] px-2 py-0.5 font-display text-lg font-bold text-brand-ink italic">VS</span>
            )}
          </span>
          <Team team={item.away} />
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 border-t border-white/10 px-4 py-3 text-center text-xs text-white/70">
          {time && <strong className="font-heading text-sm text-[var(--flag-yellow)]">{time}</strong>}
          {item.venue && <span>{item.venue}</span>}
        </p>
      </Link>
    </li>
  );
}
