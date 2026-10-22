import Link from "next/link";
import { ClubLogo } from "@/components/public/club-logo";
import { hasScore, isLive, MATCH_STATUS_LABELS } from "@/lib/competitions";
import { formatDateTime } from "@/lib/format";
import type { MatchRow } from "@/lib/queries/competitions";

/**
 * Une ligne de calendrier : date, équipes, score ou statut.
 * `official` (portail) : un score terminé n'est affiché qu'une fois validé par l'organisateur ;
 * un match en cours n'est « en direct » que sur saisie officielle de la feuille de match.
 */
export function MatchLine({ row, href, byeLabel = "exempt", official = false }: { row: MatchRow; href?: string; byeLabel?: string; official?: boolean }) {
  const { match: m, home, away } = row;
  const awaiting = official && m.status === "FINISHED" && !m.validatedAt;
  const played = hasScore(m.status) && !awaiting;
  const live = isLive(m.status);
  const name = (c: typeof home) => c?.shortName ?? c?.name;
  const content = (
    <>
      <span className="col-span-3 text-xs text-muted-foreground sm:col-span-1">
        {live ? (
          <span className="font-semibold text-[var(--flag-red,#dc241f)]">● {MATCH_STATUS_LABELS[m.status]}</span>
        ) : m.kickoffAt ? (
          formatDateTime(m.kickoffAt)
        ) : (
          "Date à fixer"
        )}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2 font-medium">
        <span className="truncate">{name(home) ?? "À déterminer"}</span>
        {home && <ClubLogo src={home.logo} name={home.name} className="size-7 text-[0.6rem]" />}
      </span>
      <span className={`min-w-16 text-center font-bold tabular-nums ${played ? "rounded-md bg-brand-ink px-2 py-1 font-heading text-base text-white" : ""}`}>
        {home && !away && m.bracketSlot !== null ? (
          <span className="text-xs font-normal text-muted-foreground">{byeLabel}</span>
        ) : played ? (
          <>
            {m.homeScore ?? 0} – {m.awayScore ?? 0}
            {m.homePenalties !== null && m.awayPenalties !== null && (
              <span className="block font-sans text-[0.65rem] font-normal text-white/70">
                t.a.b. {m.homePenalties}–{m.awayPenalties}
              </span>
            )}
          </>
        ) : awaiting ? (
          <span className="text-xs font-normal text-muted-foreground">Résultat en attente</span>
        ) : m.status === "SCHEDULED" ? (
          <span className="text-xs font-normal text-muted-foreground">–</span>
        ) : (
          <span className="text-xs font-normal text-destructive">{MATCH_STATUS_LABELS[m.status]}</span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        {away && <ClubLogo src={away.logo} name={away.name} className="size-7 text-[0.6rem]" />}
        <span className="truncate">{home && !away && m.bracketSlot !== null ? "" : (name(away) ?? "À déterminer")}</span>
      </span>
    </>
  );
  // Téléphone : date au-dessus, noms tronqués plutôt que de déborder sur la ligne voisine.
  const cls = "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto_minmax(0,1fr)]";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-accent`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
