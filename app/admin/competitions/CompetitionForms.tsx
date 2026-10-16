"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { COMPETITION_GENDER_LABELS, COMPETITION_TYPE_LABELS, COMPETITION_TYPES } from "@/lib/competitions";
import { CATEGORIES, CATEGORY_LABELS, seasonLabel } from "@/lib/licenses";
import type { Option } from "@/lib/queries/reference";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function CompetitionForm({ action, season }: { action: Action; season: number }) {
  const { state, pending, formProps } = useActionForm(action);
  const [type, setType] = useState("LEAGUE");
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="name" required placeholder="Championnat national Ligue 1" className="sm:col-span-2" errors={fe?.name} />
      <SelectField label="Saison" name="season" defaultValue={season}>
        {[season, season + 1].map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </SelectField>
      <SelectField label="Type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
        {COMPETITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {COMPETITION_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Catégorie" name="category" defaultValue="SENIOR">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Genre" name="gender" defaultValue="M">
        {Object.entries(COMPETITION_GENDER_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </SelectField>
      {type === "LEAGUE" && (
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" name="doubleRound" defaultChecked className="size-5 accent-[var(--flag-green)]" /> Matchs aller et retour
        </label>
      )}
      <fieldset className="grid grid-cols-3 gap-3 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Barème de points</legend>
        <TextField label="Victoire" name="pointsWin" type="number" defaultValue={3} required />
        <TextField label="Nul" name="pointsDraw" type="number" defaultValue={1} required />
        <TextField label="Défaite" name="pointsLoss" type="number" defaultValue={0} required />
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Créer la compétition
        </Button>
      </div>
    </form>
  );
}

export function EngageForm({ action, clubs, pools }: { action: Action; clubs: Option[]; pools: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <SelectField label="Club affilié" name="clubId" required defaultValue="" className="sm:w-72">
        <option value="">— Choisir —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {pools && <TextField label="Poule (facultatif)" name="pool" maxLength={8} placeholder="A" className="sm:w-32" />}
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Engager
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

export function PenaltyForm({ action, current }: { action: Action; current: number }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <input name="points" type="number" min={0} max={100} defaultValue={current} aria-label="Points de pénalité" className="h-8 w-16 rounded border px-2" />
      <input name="reason" placeholder="Motif" aria-label="Motif de la pénalité" className="h-8 w-32 rounded border px-2" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Pénalité
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

export function StatusSelectForm({
  action,
  current,
  options,
  label,
}: {
  action: Action;
  current: string;
  options: Record<string, string>;
  label: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2">
      <SelectField label={label} name="status" defaultValue={current}>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Appliquer
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
