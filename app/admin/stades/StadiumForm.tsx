"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;
type StadiumValues = {
  name: string;
  city: string;
  address: string | null;
  capacity: number | null;
  surface: string | null;
  openedYear: number | null;
  description: string | null;
  active: boolean;
};

export const SURFACES = ["Pelouse naturelle", "Pelouse synthétique", "Pelouse hybride"] as const;

/** Stade : nom, ville, adresse, capacité, pelouse, année d'inauguration, présentation. */
export function StadiumForm({ action, initial, submitLabel }: { action: Action; initial?: StadiumValues; submitLabel: string }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: !initial });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="name" required defaultValue={initial?.name} placeholder="Ex. Stade Alphonse Massamba-Débat" errors={fe?.name} />
      <TextField label="Ville" name="city" required defaultValue={initial?.city} placeholder="Ex. Brazzaville" errors={fe?.city} />
      <TextField label="Adresse" name="address" defaultValue={initial?.address ?? ""} className="sm:col-span-2" errors={fe?.address} />
      <TextField label="Capacité (places)" name="capacity" type="number" min={1} defaultValue={initial?.capacity ? String(initial.capacity) : ""} errors={fe?.capacity} />
      <SelectField label="Pelouse" name="surface" defaultValue={initial?.surface ?? ""}>
        <option value="">Non précisée</option>
        {SURFACES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectField>
      <TextField label="Année d'inauguration" name="openedYear" type="number" min={1850} max={2100} defaultValue={initial?.openedYear ? String(initial.openedYear) : ""} errors={fe?.openedYear} />
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="size-5 accent-[var(--flag-green)]" /> Proposé pour les nouveaux matchs
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Présentation (histoire, rénovations, accès)
        <textarea name="description" rows={4} defaultValue={initial?.description ?? ""} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
