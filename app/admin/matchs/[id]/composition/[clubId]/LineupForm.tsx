"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { MAX_SUBSTITUTES, STARTERS } from "@/lib/competitions";
import { useActionForm } from "@/lib/use-action-form";

type Row = { id: number; name: string; position: string; selected: boolean; starter: boolean; shirtNumber: number | null; suspended: string | null };

export function LineupForm({ action, rows }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; rows: Row[] }) {
  const { state, pending, formProps } = useActionForm(action);
  const [sel, setSel] = useState(() => new Map(rows.map((r) => [r.id, r.selected ? (r.starter ? "starter" : "sub") : "none"])));
  const starters = [...sel.values()].filter((v) => v === "starter").length;
  const subs = [...sel.values()].filter((v) => v === "sub").length;

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <p className="text-sm">
        <strong className={starters === STARTERS ? "" : "text-destructive"}>
          {starters}/{STARTERS} titulaires
        </strong>{" "}
        · {subs}/{MAX_SUBSTITUTES} remplaçants
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => {
          const v = sel.get(r.id) ?? "none";
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <strong>{r.name}</strong> <span className="text-xs text-muted-foreground">{r.position}</span>
                {r.suspended && <span className="ml-2 rounded bg-destructive/10 px-1.5 text-xs font-semibold text-destructive">Suspendu — {r.suspended}</span>}
              </span>
              <span className="flex items-center gap-2">
                <select
                  aria-label={`Rôle de ${r.name}`}
                  disabled={Boolean(r.suspended)}
                  value={v}
                  onChange={(e) => setSel((prev) => new Map(prev).set(r.id, e.target.value))}
                  className="h-9 rounded-md border px-2"
                >
                  <option value="none">—</option>
                  <option value="starter">Titulaire</option>
                  <option value="sub">Remplaçant</option>
                </select>
                <input
                  name={`shirt_${r.id}`}
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={r.shirtNumber ?? ""}
                  disabled={v === "none"}
                  aria-label={`Numéro de ${r.name}`}
                  placeholder="N°"
                  className="h-9 w-16 rounded-md border px-2"
                />
                {v !== "none" && <input type="hidden" name="playerIds" value={r.id} />}
                {v === "starter" && <input type="hidden" name={`starter_${r.id}`} value="on" />}
              </span>
            </li>
          );
        })}
      </ul>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-fit">
        Enregistrer la composition
      </Button>
    </form>
  );
}
