import { GATE_FLOW_WINDOW_MINUTES, GATE_LEVEL_LABELS, type GateLevel } from "@/lib/ticketing";
import type { gateCounts } from "@/lib/queries/gates";

const TONE: Record<GateLevel, string> = {
  OK: "bg-[color-mix(in_oklch,var(--flag-green)_20%,transparent)]",
  WARN: "bg-[color-mix(in_oklch,var(--flag-yellow)_40%,transparent)]",
  SATURATED: "bg-destructive text-white",
};

/** Comptage par porte et alerte de saturation (EF-CTL-07). */
export function GatePanel({ gates }: { gates: Awaited<ReturnType<typeof gateCounts>> }) {
  if (gates.length === 0) return null;
  const saturated = gates.filter((g) => g.level === "SATURATED");
  return (
    <section aria-label="Comptage par porte" className="flex flex-col gap-3">
      <h2 className="font-semibold">Comptage par porte</h2>
      {saturated.length > 0 && (
        <p role="alert" className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm font-semibold">
          {saturated.map((g) => `${g.gate} saturée : ${g.reasons.join(", ")}`).join(" · ")}. Orientez le public vers une autre porte ou renforcez le contrôle.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider">
            <tr>
              {["Porte", "Entrées", `Débit (${GATE_FLOW_WINDOW_MINUTES} min)`, "Attendus", "Capacité", "État"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {gates.map((g) => (
              <tr key={g.gate} data-testid={`gate-${g.gate}`}>
                <td className="px-3 py-2 font-medium">{g.gate}</td>
                <td className="px-3 py-2 tabular-nums" data-testid="gate-entries">{g.entries}</td>
                <td className="px-3 py-2 tabular-nums">{Math.round(g.perMinute * 10) / 10} / min (max. {g.flowLimit})</td>
                <td className="px-3 py-2 tabular-nums">{g.expected}</td>
                <td className="px-3 py-2 tabular-nums">{g.capacity ? `${g.capacity} · ${Math.round(g.fill * 100)} %` : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TONE[g.level]}`}>{GATE_LEVEL_LABELS[g.level]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
