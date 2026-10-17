"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { PRESS_ZONE_LABELS, PRESS_ZONES, type PressZone } from "@/lib/accreditations";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function DecisionForm({ approve, refuse, requested, who }: { approve: Action; refuse: Action; requested: PressZone[]; who: string }) {
  const ok = useActionForm(approve);
  const ko = useActionForm(refuse);
  return (
    <div className="flex flex-col gap-2">
      <form {...ok.formProps} className="flex flex-wrap items-center gap-3 text-xs">
        {PRESS_ZONES.map((z) => (
          <label key={z} className="flex items-center gap-1">
            <input type="checkbox" name="zones" value={z} defaultChecked={requested.includes(z)} aria-label={`${PRESS_ZONE_LABELS[z]} pour ${who}`} /> {PRESS_ZONE_LABELS[z]}
          </label>
        ))}
        <Button type="submit" size="sm" disabled={ok.pending}>
          Approuver
        </Button>
      </form>
      <form {...ko.formProps} className="flex flex-wrap items-center gap-2 text-xs">
        <input name="reason" placeholder="Motif" aria-label={`Motif du refus pour ${who}`} className="h-8 w-40 rounded border px-2" />
        <Button type="submit" size="sm" variant="destructive" disabled={ko.pending}>
          Refuser
        </Button>
      </form>
      <FormMessage state={ok.state ?? ko.state} />
    </div>
  );
}

export function QuotaForm({ action, quotas }: { action: Action; quotas: Partial<Record<PressZone, number>> }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3 text-sm">
      {PRESS_ZONES.map((z) => (
        <label key={z} className="flex flex-col gap-1">
          {PRESS_ZONE_LABELS[z]}
          <input name={`quota_${z}`} type="number" min={0} defaultValue={quotas[z] ?? ""} placeholder="illimité" className="h-9 w-28 rounded-md border px-2" />
        </label>
      ))}
      <Button type="submit" variant="outline" disabled={pending} className="h-9">
        Enregistrer les quotas
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
