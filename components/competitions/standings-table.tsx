import type { StandingRow } from "@/lib/competitions";

type Row = StandingRow & { name: string; shortName: string | null };

const FORM_CLASS = { V: "bg-[var(--flag-green)] text-white", N: "bg-muted text-foreground", D: "bg-destructive text-white" } as const;

/** Classement : points, différence de buts, buts marqués (RG-07), forme sur 5 matchs. */
export function StandingsTable({ rows, title }: { rows: Row[]; title?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      {title && <p className="border-b px-3 py-2 font-heading text-base font-semibold uppercase tracking-wide">{title}</p>}
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-brand-ink text-xs uppercase tracking-wider text-white/80">
          <tr>
            {["#", "Équipe", "J", "G", "N", "P", "BP", "BC", "Diff", "Pts", "Forme"].map((h) => (
              <th key={h} className={`px-2 py-2 font-semibold ${h === "Équipe" ? "text-left" : "text-center"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={r.clubId} className="even:bg-muted/40">
              <td className="px-2 py-2 text-center font-semibold">
                <span className={`inline-flex size-6 items-center justify-center rounded ${i === 0 ? "bg-[var(--flag-yellow)] text-brand-ink" : ""}`}>{i + 1}</span>
              </td>
              <td className="px-2 py-2 font-medium">
                {r.name}
                {r.penalty > 0 && <span className="ml-1 text-xs text-destructive">(−{r.penalty} pts)</span>}
              </td>
              {[r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst].map((v, j) => (
                <td key={j} className="px-2 py-2 text-center">
                  {v}
                </td>
              ))}
              <td className="px-2 py-2 text-center">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="px-2 py-2 text-center font-heading text-base font-bold">{r.points}</td>
              <td className="px-2 py-2">
                <span className="flex justify-center gap-0.5">
                  {r.form.map((f, j) => (
                    <span key={j} className={`inline-flex size-5 items-center justify-center rounded-sm text-[0.6rem] font-bold ${FORM_CLASS[f]}`}>
                      {f}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScorersList({ scorers }: { scorers: { playerId: number; goals: number; player?: { lastName: string; firstName: string; club: string | null } }[] }) {
  if (scorers.length === 0) return <p className="text-sm text-muted-foreground">Aucun but marqué.</p>;
  return (
    <ol className="flex flex-col divide-y rounded-xl border bg-card text-sm shadow-sm">
      {scorers.map((s, i) => (
        <li key={s.playerId} className="flex items-center justify-between gap-3 px-3 py-2">
          <span>
            <span className="mr-2 text-muted-foreground">{i + 1}.</span>
            <strong>
              {s.player?.firstName} {s.player?.lastName}
            </strong>
            <span className="ml-2 text-xs text-muted-foreground">{s.player?.club}</span>
          </span>
          <span className="font-heading text-xl font-bold">{s.goals}</span>
        </li>
      ))}
    </ol>
  );
}
