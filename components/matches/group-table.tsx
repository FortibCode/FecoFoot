import Link from "next/link";
import type { GroupRow } from "@/lib/competitions";
import type { GroupFixture } from "@/lib/queries/national";
import { TeamBadge } from "@/components/public/team-badge";
import { flagUrl } from "@/lib/flags";
import { formatMatchDate } from "@/lib/format";

const FORM_TONE = { V: "bg-[var(--flag-green)] text-white", N: "bg-[var(--flag-yellow)] text-brand-ink", D: "bg-[var(--flag-red)] text-white" } as const;

function Flag({ name }: { name: string }) {
  return <TeamBadge name={name} flag={flagUrl(name)} size="xs" />;
}

/**
 * Classement d'un groupe : rang (places qualificatives en vert), pays, forme, points, matchs, victoires,
 * nuls, défaites, buts, différence. Le Congo est mis en évidence.
 */
export function GroupTable({ rows, qualifiers }: { rows: GroupRow[]; qualifiers: number }) {
  const cols = ["Pts", "J", "G", "N", "P", "BP", "BC", "Diff"];
  return (
    <div className="overflow-x-auto rounded-2xl bg-muted/60">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="bg-brand-ink text-xs text-white/80 uppercase">
          <tr>
            <th scope="col" className="w-10 px-2 py-2 text-center font-semibold">
              #
            </th>
            <th scope="col" className="px-2 py-2 text-left font-semibold">
              Équipe
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className="w-11 px-1 py-2 text-center font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {rows.map((r, i) => {
            const qualified = i < qualifiers;
            const congo = r.team === "Congo";
            return (
              <tr key={r.team} className={congo ? "bg-[color-mix(in_srgb,var(--flag-green)_10%,transparent)] font-semibold" : ""}>
                <td className="relative px-2 py-2.5 text-center font-semibold">
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${qualified ? "bg-[var(--flag-green)]" : "bg-[var(--flag-red)]"}`} />
                  {i + 1}
                  <span className="sr-only">{qualified ? ", place qualificative" : ", hors des places qualificatives"}</span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <Flag name={r.team} />
                      {r.team}
                    </span>
                    {r.form.length > 0 && (
                      <span className="flex gap-0.5" aria-label={`Forme : ${r.form.join(", ")}`}>
                        {r.form.map((f, k) => (
                          <span key={k} aria-hidden className={`grid size-4 place-items-center rounded-[3px] text-[0.55rem] font-bold ${FORM_TONE[f]}`}>
                            {f}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-1 py-2.5 text-center font-bold">{r.points}</td>
                <td className="px-1 py-2.5 text-center">{r.played}</td>
                <td className="px-1 py-2.5 text-center">{r.won}</td>
                <td className="px-1 py-2.5 text-center">{r.drawn}</td>
                <td className="px-1 py-2.5 text-center">{r.lost}</td>
                <td className="px-1 py-2.5 text-center">{r.goalsFor}</td>
                <td className="px-1 py-2.5 text-center">{r.goalsAgainst}</td>
                <td className={`px-1 py-2.5 text-center ${r.goalDiff > 0 ? "text-[var(--flag-green)]" : r.goalDiff < 0 ? "text-[var(--flag-red)]" : ""}`}>
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-5 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-1 rounded-full bg-[var(--flag-green)]" /> Place qualificative ({qualifiers})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-1 rounded-full bg-[var(--flag-red)]" /> Hors des places qualificatives
        </span>
      </p>
    </div>
  );
}

/** Rencontres du groupe par journée ; les matchs du Congo mènent à leur fiche. */
export function GroupMatchdays({ fixtures, current }: { fixtures: GroupFixture[]; current?: string }) {
  const days = [...new Set(fixtures.map((f) => f.matchday))];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {days.map((d) => (
        <section key={d} aria-label={`Journée ${d}`} className="overflow-hidden rounded-2xl bg-muted/60">
          <h3 className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold uppercase tracking-wide">{d ? `Journée ${d}` : "Journée à préciser"}</h3>
          <ul className="divide-y">
            {fixtures
              .filter((f) => f.matchday === d)
              .map((f) => {
                const body = (
                  <>
                    <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                      <span className="truncate">{f.home.name}</span>
                      <Flag name={f.home.name} />
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-center font-semibold whitespace-nowrap tabular-nums ${f.score ? "bg-brand-ink text-white" : "bg-muted text-muted-foreground"}`}>
                      {f.score ? `${f.score[0]} - ${f.score[1]}` : f.status === "CANCELLED" ? "Annulé" : "–"}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Flag name={f.away.name} />
                      <span className="truncate">{f.away.name}</span>
                    </span>
                    <span className="col-span-3 text-center text-xs text-muted-foreground">{f.date ? formatMatchDate(f.date) : "Date à préciser"}</span>
                  </>
                );
                const cls = `grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 px-3 py-2.5 text-sm ${f.key === current ? "bg-[color-mix(in_srgb,var(--flag-yellow)_16%,transparent)]" : ""}`;
                return (
                  <li key={f.key}>
                    {f.href ? (
                      <Link href={f.href} aria-current={f.key === current ? "page" : undefined} className={`${cls} transition-colors hover:bg-muted/60`}>
                        {body}
                      </Link>
                    ) : (
                      <div className={cls}>{body}</div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
