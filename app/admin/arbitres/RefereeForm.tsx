"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import type { Option } from "@/lib/queries/reference";
import { REFEREE_GRADE_LABELS, REFEREE_GRADES } from "@/lib/referees";
import { useActionForm } from "@/lib/use-action-form";

type Values = { lastName: string; firstName: string; grade: string; leagueId: number | null; phone: string | null; email: string | null; active: boolean };

export function RefereeForm({
  action,
  leagues,
  initial,
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  leagues: Option[];
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
      <SelectField label="Ligue" name="leagueId" defaultValue={initial?.leagueId ?? ""}>
        <option value="">—</option>
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
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
