"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import type { Option } from "@/lib/queries/reference";
import { NATIONAL_LEVEL, REFEREE_GRADE_LABELS, REFEREE_GRADES, scopeValue } from "@/lib/referees";
import { useActionForm } from "@/lib/use-action-form";

type Values = { lastName: string; firstName: string; grade: string; leagueId: number | null; championshipId: number | null; phone: string | null; email: string | null; active: boolean };

export function RefereeForm({
  action,
  leagues,
  divisions,
  initial,
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  leagues: Option[];
  divisions: Option[];
  initial?: Values;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="lastName" required defaultValue={initial?.lastName} errors={fe?.lastName} />
      <TextField label="Prénom" name="firstName" required defaultValue={initial?.firstName} errors={fe?.firstName} />
      <SelectField label="Grade" name="grade" defaultValue={initial?.grade ?? "LEAGUE"}>
        {REFEREE_GRADES.map((g) => (
          <option key={g} value={g}>
            {REFEREE_GRADE_LABELS[g]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Ligue ou division" name="scope" defaultValue={initial ? scopeValue(initial) : ""} errors={fe?.scope}>
        <option value="">{NATIONAL_LEVEL}</option>
        <optgroup label="Divisions nationales">
          {divisions.map((d) => (
            <option key={d.id} value={`c:${d.id}`}>
              {d.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Ligues départementales">
          {leagues.map((l) => (
            <option key={l.id} value={`l:${l.id}`}>
              {l.name}
            </option>
          ))}
        </optgroup>
      </SelectField>
      <TextField label="Téléphone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} errors={fe?.phone} />
      <TextField label="E-mail" name="email" type="email" defaultValue={initial?.email ?? ""} errors={fe?.email} />
      {initial && (
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="size-5 accent-[var(--flag-green)]" /> Actif
        </label>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
