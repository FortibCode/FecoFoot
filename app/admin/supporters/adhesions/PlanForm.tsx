"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { MEMBERSHIP_TIER_LABELS, type MembershipTier } from "@/lib/supporters";
import { useActionForm } from "@/lib/use-action-form";

export function PlanForm({ action, tier, price, open }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; tier: MembershipTier; price: number | null; open: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="plan-card">
      <input type="hidden" name="tier" value={tier} />
      <p className="plan-card-title">
        Formule {MEMBERSHIP_TIER_LABELS[tier].toLowerCase()}
        <span className="plan-card-price">{price !== null ? `${new Intl.NumberFormat("fr-FR").format(price)} FCFA` : "Tarif à définir"}</span>
      </p>
      <label className="flex flex-col gap-1">
        Prix (FCFA)
        <input name="price" type="number" min={0} step={1} required defaultValue={price ?? ""} aria-label={`Prix ${MEMBERSHIP_TIER_LABELS[tier]}`} className="w-full" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="open" defaultChecked={open} className="size-5 accent-[var(--flag-green)]" /> Ouverte
      </label>
      <Button type="submit" disabled={pending}>
        Enregistrer
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
