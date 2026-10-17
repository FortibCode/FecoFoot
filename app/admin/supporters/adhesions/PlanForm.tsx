"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { MEMBERSHIP_TIER_LABELS, type MembershipTier } from "@/lib/supporters";
import { useActionForm } from "@/lib/use-action-form";

export function PlanForm({ action, tier, price, open }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; tier: MembershipTier; price: number | null; open: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3 rounded-lg border p-3 text-sm">
      <input type="hidden" name="tier" value={tier} />
      <p className="w-24 font-semibold">{MEMBERSHIP_TIER_LABELS[tier]}</p>
      <label className="flex flex-col gap-1">
        Prix (FCFA)
        <input name="price" type="number" min={0} step={1} required defaultValue={price ?? ""} aria-label={`Prix ${MEMBERSHIP_TIER_LABELS[tier]}`} className="h-10 w-32 rounded-md border px-2" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="open" defaultChecked={open} className="size-5 accent-[var(--flag-green)]" /> Ouverte
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Enregistrer
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
