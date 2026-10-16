import Link from "next/link";
import { MATCH_STATUS_LABELS } from "@/lib/competitions";
import { formatDateTime } from "@/lib/format";
import type { MatchRow } from "@/lib/queries/competitions";

/** Une ligne de calendrier : date, équipes, score ou statut. */
export function MatchLine({ row, href, byeLabel = "exempt" }: { row: MatchRow; href?: string; byeLabel?: string }) {
  const { match: m, home, away } = row;
  const played = m.status === "FINISHED" || m.status === "LIVE";
  const name = (c: typeof home) => c?.shortName ?? c?.name;
  const content = (
    <>
      <span className="col-span-3 text-xs text-muted-foreground sm:col-span-1">{m.kickoffAt ? formatDateTime(m.kickoffAt) : "Date à fixer"}</span>
      <span className="min-w-0 truncate text-right font-medium">{name(home) ?? "À déterminer"}</span>
      <span className="w-16 text-center font-bold tabular-nums">
        {home && !away && m.bracketSlot !== null ? (
          <span className="text-xs font-normal text-muted-foreground">{byeLabel}</span>
        ) : played ? (
          <>
            {m.homeScore ?? 0} – {m.awayScore ?? 0}
            {m.homePenalties !== null && m.awayPenalties !== null && (
              <span className="block text-[0.65rem] font-normal text-muted-foreground">
                t.a.b. {m.homePenalties}–{m.awayPenalties}
              </span>
            )}
          </>
        ) : m.status === "SCHEDULED" ? (
          <span className="text-xs font-normal text-muted-foreground">–</span>
        ) : (
          <span className="text-xs font-normal text-destructive">{MATCH_STATUS_LABELS[m.status]}</span>
        )}
      </span>
      <span className="min-w-0 truncate font-medium">{home && !away && m.bracketSlot !== null ? "" : (name(away) ?? "À déterminer")}</span>
    </>
  );
  // Téléphone : date au-dessus, noms tronqués plutôt que de déborder sur la ligne voisine.
  const cls = "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto_minmax(0,1fr)]";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-muted`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
