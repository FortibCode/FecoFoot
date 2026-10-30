import { standingZone, type StandingRow } from "@/lib/competitions";

type Row = StandingRow & { name: string; shortName: string | null };

/** Colonnes masquées sur téléphone (classement compact : rang, équipe, joués, différence, points). */
const COMPACT_HIDDEN = new Set(["G", "N", "P", "BP", "BC", "Forme"]);

const FORM_CLASS = { V: "bg-[var(--flag-green)] text-white", N: "bg-muted text-foreground", D: "bg-destructive text-white" } as const;

/**
 * Classement : points, différence de buts, buts marqués (RG-07), forme sur 5 matchs.
 * `logos` : logos des clubs (portail) ; `animate` : lignes qui entrent en cascade et barres de points
 * qui se remplissent à l'apparition. Avant la première journée, les clubs sont classés par ordre alphabétique.
 */
export type StandingsRow = Row;

/** Ordre d'affichage : classement réel, ou alphabétique avant la première journée. */
export function orderStandings(rows: Row[]) {
  const started = rows.some((r) => r.played > 0);
  const ordered = started ? rows : [...rows].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { ordered, started, maxPoints: Math.max(1, ...ordered.map((r) => r.points)) };
}

export function StandingsTable({
  rows,
  title,
  logos,
  animate = false,
  slice,
  enter = "left",
  zones,
  highlight = [],
}: {
  rows: Row[];
  title?: string;
  logos?: Record<number, string>;
  animate?: boolean;
  /** Pagination : partie du classement affichée (le rang reste celui du classement complet). */
  slice?: { start: number; end: number };
  /** Sens d'entrée des lignes (changement de page). */
  enter?: "left" | "right";
  /** Places de montée et de descente de la saison : liseré vert / rouge et légende. */
  zones?: { promotion: number; relegation: number };
  /** Clubs mis en évidence (les deux équipes d'un match). */
  highlight?: number[];
}) {
  const { ordered: all, started, maxPoints } = orderStandings(rows);
  const offset = slice?.start ?? 0;
  const ordered = slice ? all.slice(slice.start, slice.end) : all;
  return (
    <div className="overflow-x-auto rounded-xl bg-muted/60">
      {title && <p className="border-b px-3 py-2 font-heading text-base font-semibold uppercase tracking-wide">{title}</p>}
      <table className="w-full text-sm sm:min-w-[640px]">
        <thead className="bg-brand-ink text-xs uppercase tracking-wider text-white/80">
          <tr>
            {[
              ["#", "Rang"],
              ["Équipe", "Équipe"],
              ["J", "Matchs joués"],
              ["G", "Gagnés"],
              ["N", "Nuls"],
              ["P", "Perdus"],
              ["BP", "Buts pour"],
              ["BC", "Buts contre"],
              ["Diff", "Différence de buts"],
              ["Pts", "Points"],
              ["Forme", "Cinq derniers matchs"],
            ].map(([h, full]) => (
              <th
                key={h}
                title={full}
                className={`px-2 py-3 font-semibold ${h === "Équipe" ? "text-left" : "text-center"} ${COMPACT_HIDDEN.has(h) ? "hidden sm:table-cell" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {ordered.map((r, idx) => {
            const i = offset + idx;
            const leader = started && i === 0;
            const zone = started && zones ? standingZone(i + 1, all.length, zones) : null;
            return (
              <tr
                key={r.clubId}
                {...(animate ? { "data-reveal": enter, style: { ["--rd" as string]: `${Math.min(idx, 16) * 60}ms` } } : {})}
                aria-current={highlight.includes(r.clubId) || undefined}
                className={`group transition-colors hover:bg-accent/70 ${highlight.includes(r.clubId) ? "bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] font-semibold" : leader ? "bg-[color-mix(in_srgb,var(--flag-yellow)_14%,transparent)]" : "even:bg-muted/40"}`}
              >
                <td className="relative px-2 py-2.5 text-center font-semibold">
                  {(leader || zone) && (
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-1 ${zone === "promotion" ? "bg-[var(--flag-green)]" : zone === "relegation" ? "bg-destructive" : "bg-[var(--flag-yellow)]"}`}
                    />
                  )}
                  {zone && <span className="sr-only">{zone === "promotion" ? "Zone de montée" : "Zone de descente"}</span>}
                  <span className={`inline-flex size-7 items-center justify-center rounded-md font-heading text-base ${leader ? "bg-[var(--flag-yellow)] text-brand-ink" : ""}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-3">
                    {logos && (logos[r.clubId] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
                      <img src={logos[r.clubId]} alt="" loading="lazy" className="size-8 shrink-0 object-contain transition-transform duration-300 motion-safe:group-hover:scale-110" />
                    ) : (
                      <span className="size-8 shrink-0" />
                    ))}
                    <span className="font-semibold leading-tight">{r.name}</span>
                    {r.penalty > 0 && <span className="text-xs text-destructive">(−{r.penalty} pts)</span>}
                  </span>
                </td>
                {[r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst].map((v, j) => (
                  <td key={j} className={`px-2 py-2.5 text-center tabular-nums ${j > 0 ? "hidden sm:table-cell" : ""}`}>
                    {v}
                  </td>
                ))}
                <td className={`px-2 py-2.5 text-center tabular-nums ${r.goalDiff > 0 ? "text-[var(--flag-green)]" : r.goalDiff < 0 ? "text-destructive" : ""}`}>
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="font-heading text-lg font-bold tabular-nums">{r.points}</span>
                  {animate && started && (
                    <span aria-hidden className="mx-auto mt-0.5 block h-1 w-12 overflow-hidden rounded-full bg-muted">
                      <span className="points-bar block h-full rounded-full bg-[var(--flag-green)]" style={{ width: `${(r.points / maxPoints) * 100}%` }} />
                    </span>
                  )}
                </td>
                <td className="hidden px-2 py-2.5 sm:table-cell">
                  <span className="flex justify-center gap-0.5">
                    {r.form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {r.form.map((f, j) => (
                      <span key={j} className={`inline-flex size-5 items-center justify-center rounded-sm text-[0.6rem] font-bold ${FORM_CLASS[f]}`}>
                        {f}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
          {/* Dernière page incomplète : lignes vides pour garder la même hauteur (pas de saut de mise en page). */}
          {slice &&
            Array.from({ length: Math.max(0, slice.end - slice.start - ordered.length) }, (_, k) => (
              <tr key={`vide-${k}`} aria-hidden className="h-[3.3rem]">
                <td colSpan={11} />
              </tr>
            ))}
        </tbody>
      </table>
      {zones && (zones.promotion > 0 || zones.relegation > 0) && (
        <p className="flex flex-wrap gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
          {zones.promotion > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-1 bg-[var(--flag-green)]" /> Montée ({zones.promotion})
            </span>
          )}
          {zones.relegation > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-1 bg-destructive" /> Descente ({zones.relegation})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function ScorersList({ scorers }: { scorers: { playerId: number; goals: number; player?: { lastName: string; firstName: string; club: string | null } }[] }) {
  if (scorers.length === 0) return <p className="text-sm text-muted-foreground">Aucun but marqué.</p>;
  return (
    <ol className="flex flex-col divide-y rounded-xl bg-muted/60 text-sm">
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
