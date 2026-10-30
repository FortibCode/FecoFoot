import Link from "next/link";
import { TeamBadge } from "@/components/public/team-badge";

type Side = { name: string; logo?: string | null; flag?: string | null };

/** Un résultat récent : rencontre, score et issue du point de vue de l'équipe suivie. */
export type FormItem = { id: number; href: string; date: Date | null; home: Side; away: Side; score: [number, number]; result: "V" | "N" | "D" };

const RESULT = {
  V: { tone: "bg-[var(--flag-green)] text-white", label: "Victoire" },
  N: { tone: "bg-[var(--flag-yellow)] text-brand-ink", label: "Nul" },
  D: { tone: "bg-[var(--flag-red)] text-white", label: "Défaite" },
} as const;
const short = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit" });

function Mark({ side }: { side: Side }) {
  return <TeamBadge name={side.name} logo={side.logo} flag={side.flag} size="xs" />;
}

/**
 * Forme récente en lignes, du plus récent au plus ancien : date, équipes (logo ou drapeau), score et
 * pastille V / N / D. Chaque ligne mène à la fiche du match.
 */
export function FormRows({ items, empty = "Aucun résultat officiel enregistré." }: { items: FormItem[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="flex flex-col divide-y overflow-hidden rounded-xl bg-card">
      {items.map((f) => (
        <li key={f.id}>
          <Link
            href={f.href}
            title={f.date ? short.format(f.date) : undefined}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_1.5rem] items-center gap-2 px-2.5 py-2 text-sm sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)_1.75rem] transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flag-green"
          >
            {/* Date : sur téléphone, dans l'infobulle seulement (place aux noms). */}
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{f.date ? short.format(f.date) : ""}</span>
            <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
              <span className="truncate">{f.home.name}</span>
              <Mark side={f.home} />
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 font-semibold whitespace-nowrap tabular-nums">
              {f.score[0]} - {f.score[1]}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Mark side={f.away} />
              <span className="truncate">{f.away.name}</span>
            </span>
            <span title={RESULT[f.result].label} className={`grid size-6 place-items-center rounded-full text-[0.7rem] font-bold ${RESULT[f.result].tone}`}>
              <span aria-hidden>{f.result}</span>
              <span className="sr-only">{RESULT[f.result].label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Statistiques comparées des deux équipes : valeur de chaque côté et barres proportionnelles. */
export function CompareStats({ rows }: { rows: { label: string; home: number | string; away: number | string; homeN?: number; awayN?: number }[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map((r) => {
        const h = r.homeN ?? (typeof r.home === "number" ? r.home : 0);
        const a = r.awayN ?? (typeof r.away === "number" ? r.away : 0);
        const sum = h + a || 1;
        return (
          <div key={r.label} className="flex flex-col gap-1.5 text-sm">
            <div className="grid grid-cols-[3rem_1fr_3rem] items-center">
              <dd className={`tabular-nums ${h > a ? "font-bold" : ""}`}>{r.home}</dd>
              <dt className="text-center text-muted-foreground">{r.label}</dt>
              <dd className={`text-right tabular-nums ${a > h ? "font-bold" : ""}`}>{r.away}</dd>
            </div>
            <span aria-hidden className="flex h-1.5 gap-1">
              <span className="flex flex-1 justify-end overflow-hidden rounded-full bg-muted">
                <span className="rounded-full bg-brand-ink" style={{ width: `${(h / sum) * 100}%` }} />
              </span>
              <span className="flex flex-1 overflow-hidden rounded-full bg-muted">
                <span className="rounded-full bg-[var(--flag-green)]" style={{ width: `${(a / sum) * 100}%` }} />
              </span>
            </span>
          </div>
        );
      })}
    </dl>
  );
}
