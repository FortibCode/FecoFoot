"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { SANCTION_LABELS, SANCTION_TYPES, type SanctionType } from "@/lib/discipline";
import type { Option } from "@/lib/queries/reference";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function CaseForm({ action, clubs, competitions }: { action: Action; clubs: Option[]; competitions: Option[] }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TextField label="Joueur (identifiant fédéral)" name="federalId" placeholder="FCF-J-2026-000001" hint="Facultatif si le dossier vise un club." />
      <SelectField label="Club" name="clubId" defaultValue="" hint="Déduit du joueur s'il est indiqué.">
        <option value="">—</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Compétition" name="competitionId" defaultValue="">
        <option value="">— Toutes —</option>
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Audience" name="hearingAt" type="datetime-local" />
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Faits
        <textarea name="facts" required rows={4} className="rounded-md border px-3 py-2 text-sm" />
        {fe?.facts && <span className="text-xs text-destructive">{fe.facts[0]}</span>}
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Ouvrir le dossier
        </Button>
      </div>
    </form>
  );
}

export function DecisionForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action);
  const [type, setType] = useState<SanctionType>("MATCH_SUSPENSION");
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <SelectField label="Sanction" name="sanctionType" value={type} onChange={(e) => setType(e.target.value as SanctionType)}>
        {SANCTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {SANCTION_LABELS[t]}
          </option>
        ))}
      </SelectField>
      {type === "MATCH_SUSPENSION" && <TextField label="Nombre de matchs" name="suspensionMatches" type="number" min={1} required />}
      {type === "TIME_SUSPENSION" && <TextField label="Suspendu jusqu'au" name="suspensionUntil" type="date" required />}
      {type === "FINE" && <TextField label="Montant (FCFA)" name="fineAmount" type="number" min={1} required />}
      {type === "POINTS_DEDUCTION" && <TextField label="Points retirés" name="pointsDeducted" type="number" min={1} required />}
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Décision motivée
        <textarea name="decision" required rows={4} className="rounded-md border px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Rendre la décision
        </Button>
      </div>
    </form>
  );
}
