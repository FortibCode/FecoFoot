"use client";

import { useState } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import { CATEGORY_LABELS, type Category } from "@/lib/licenses";
import { useActionForm } from "@/lib/use-action-form";
import type { RenewalState } from "./actions";

type Row = { playerId: number; name: string; federalId: string; previousNumber: string; category: Category };

export function RenewalForm({ action, rows }: { action: (s: RenewalState, f: FormData) => Promise<RenewalState>; rows: Row[] }) {
  const { state, pending, formProps } = useActionForm(action);
  const [checked, setChecked] = useState<Set<number>>(new Set(rows.map((r) => r.playerId)));
  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const report = (
    <>
      <FormMessage state={state?.error ? { error: state.error } : undefined} />
      <FormMessage state={state?.success ? { success: state.success } : undefined} />
      {(state?.created?.length || state?.failed?.length) && (
        <ul className="text-sm">
          {state.created?.map((c) => <li key={c}>✓ {c}</li>)}
          {state.failed?.map((f) => <li key={f} className="text-destructive">✗ {f}</li>)}
        </ul>
      )}
    </>
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {report}
        <EmptyState icon="check" title="Aucun joueur à renouveler" compact>Tous les licenciés de la saison passée de ce club sont déjà renouvelés.</EmptyState>
      </div>
    );
  }

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => (
          <li key={r.playerId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="playerIds"
                value={r.playerId}
                checked={checked.has(r.playerId)}
                onChange={() => toggle(r.playerId)}
                className="mt-0.5 size-5 accent-[var(--flag-green)]"
              />
              <span>
                <strong>{r.name}</strong> <span className="font-mono text-xs text-muted-foreground">{r.federalId}</span>
                <br />
                <span className="text-muted-foreground">
                  {CATEGORY_LABELS[r.category]} · précédente : {r.previousNumber}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              Visite médicale
              <input
                type="date"
                name={`medical_${r.playerId}`}
                required={checked.has(r.playerId)}
                disabled={!checked.has(r.playerId)}
                aria-label={`Visite médicale de ${r.name}`}
                className="h-9 rounded-md border px-2"
              />
            </label>
          </li>
        ))}
      </ul>
      <TextField label="Droits de licence par joueur (FCFA)" name="feeAmount" type="number" inputMode="numeric" min={0} step={1} required className="max-w-xs" />
      {report}
      <Button type="submit" disabled={pending || checked.size === 0} className="h-10 w-full sm:w-fit">
        {pending ? "Dépôt…" : `Renouveler ${checked.size} licence(s)`}
      </Button>
    </form>
  );
}
