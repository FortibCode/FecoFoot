"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { MATCH_STATS, type MatchStatValues } from "@/lib/competitions";
import { STAT_PERIOD_LABELS, STAT_PERIODS, type StatPeriod } from "@/lib/match-stats";
import { useActionForm } from "@/lib/use-action-form";

const input = "h-9 w-20 rounded-md border bg-background px-2 text-center tabular-nums";

/** Saisie des statistiques d'un match, par période : valeurs domicile / extérieur, possession en %. */
export function StatsForm({
  action,
  teams,
  values,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  teams: [string, string];
  values: Partial<Record<StatPeriod, MatchStatValues>>;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [period, setPeriod] = useState<StatPeriod>("ALL");
  const v = values[period];
  const val = (k: keyof MatchStatValues) => (v?.[k] ?? "") as number | "";
  return (
    // key : les valeurs enregistrées de la période choisie remplissent le formulaire.
    <form key={period} {...formProps} className="flex max-w-2xl flex-col gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        Période
        <select name="period" value={period} onChange={(e) => setPeriod(e.target.value as StatPeriod)} className="h-9 rounded-md border bg-background px-2">
          {STAT_PERIODS.map((p) => (
            <option key={p} value={p}>
              {STAT_PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <table className="text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 text-left font-semibold">
              Statistique
            </th>
            <th scope="col" className="py-1 font-semibold">
              {teams[0]}
            </th>
            <th scope="col" className="py-1 font-semibold">
              {teams[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="py-1 text-left font-medium">
              Possession (%)
            </th>
            <td className="py-1 text-center">
              <input name="possessionHome" type="number" min={0} max={100} defaultValue={val("possessionHome")} aria-label={`Possession ${teams[0]} (%)`} className={input} />
            </td>
            <td className="py-1 text-center text-muted-foreground tabular-nums">{v?.possessionHome != null ? `${100 - v.possessionHome} %` : "auto"}</td>
          </tr>
          {MATCH_STATS.map((s) => (
            <tr key={s.key}>
              <th scope="row" className="py-1 text-left font-medium">
                {s.label}
              </th>
              {(["Home", "Away"] as const).map((side, i) => (
                <td key={side} className="py-1 text-center">
                  <input name={`${s.key}${side}`} type="number" min={0} defaultValue={val(`${s.key}${side}`)} aria-label={`${s.label} ${teams[i]}`} className={input} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
          Enregistrer les statistiques
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
