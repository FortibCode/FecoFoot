"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function LinkCompetitionForm({ action, competitions, defaultSeason }: { action: Action; competitions: { id: number; name: string }[]; defaultSeason: number }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[1fr_9rem_8rem_auto] sm:items-end">
      <SelectField label="Compétition de la plateforme" name="competitionId" required defaultValue="">
        <option value="">— Choisir —</option>
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField label="N° de ligue (fournisseur)" name="leagueId" type="number" min={1} required />
      <TextField label="Saison" name="season" type="number" min={2000} max={2100} defaultValue={defaultSeason} required />
      <Button type="submit" disabled={pending} className="h-10">
        Lier
      </Button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Association d'une équipe du fournisseur à un club ; le club proposé (nom proche) est présélectionné. */
export function ClubLinkForm({ action, clubs, suggested, linkedClubId }: { action: Action; clubs: { id: number; name: string }[]; suggested: number | null; linkedClubId: number | null }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-2">
      <select name="clubId" defaultValue={linkedClubId ?? suggested ?? ""} aria-label="Club de la plateforme" className="h-9 min-w-0 rounded-md border px-2 text-sm">
        <option value="">— Club —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant={linkedClubId ? "outline" : "default"} size="sm" disabled={pending}>
        {linkedClubId ? "Modifier" : "Associer"}
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      {state?.success && <span className="text-xs text-[var(--flag-green)]">{state.success}</span>}
    </form>
  );
}
