"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { GOVERNANCE_BODY_KIND_LABELS, GOVERNANCE_BODY_KINDS, type GovernanceBodyKind } from "@/lib/governance";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;
type BodyValues = { name: string; kind: GovernanceBodyKind; description: string | null; sortOrder: number; published: boolean };

/** Instance de la fédération : nom, type, présentation, ordre et publication sur la page « La Fédération ». */
export function BodyForm({ action, initial, submitLabel }: { action: Action; initial?: BodyValues; submitLabel: string }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
      <TextField label="Nom" name="name" required defaultValue={initial?.name} placeholder="Ex. Commission d'arbitrage" errors={fe?.name} />
      <SelectField label="Type" name="kind" defaultValue={initial?.kind ?? "PERMANENT"}>
        {GOVERNANCE_BODY_KINDS.map((k) => (
          <option key={k} value={k}>
            {GOVERNANCE_BODY_KIND_LABELS[k]}
          </option>
        ))}
      </SelectField>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Présentation (missions, composition)
        <textarea name="description" rows={4} defaultValue={initial?.description ?? ""} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <TextField label="Ordre d'affichage" name="sortOrder" type="number" defaultValue={String(initial?.sortOrder ?? 0)} errors={fe?.sortOrder} />
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="published" defaultChecked={initial?.published ?? true} className="size-5 accent-[var(--flag-green)]" /> Publiée sur « La Fédération »
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

/** Nouveau membre : nom, fonction, début du mandat et texte de référence (facultatifs). */
export function MemberForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <TextField label="Nom complet" name="fullName" required placeholder="NOM Prénom" errors={fe?.fullName} />
      <TextField label="Fonction" name="position" required placeholder="Président, Vice-président, Membre…" errors={fe?.position} />
      <TextField label="Début du mandat" name="startDate" type="date" errors={fe?.startDate} />
      <TextField label="Texte de référence" name="source" placeholder="Ex. Communiqué du Comex du 28 octobre 2026" errors={fe?.source} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          Ajouter le membre
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EndMandateForm({ action, who }: { action: Action; who: string }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <input type="date" name="endDate" required aria-label={`Fin du mandat de ${who}`} className="h-8 rounded border px-2" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Clore le mandat
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}
