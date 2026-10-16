"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import type { Option } from "@/lib/queries/reference";
import { TRANSFER_TYPE_LABELS, TRANSFER_TYPES, type TransferType } from "@/lib/transfers";
import { useActionForm } from "@/lib/use-action-form";

export function TransferForm({
  action,
  clubs,
  federalId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  clubs: Option[];
  federalId?: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [type, setType] = useState<TransferType>("DEFINITIVE");
  const fe = state?.fieldErrors;

  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField
        label="Identifiant fédéral du joueur"
        name="federalId"
        required
        defaultValue={federalId}
        placeholder="FCF-J-2026-000001"
        className="sm:col-span-2"
        errors={fe?.federalId}
      />
      <SelectField label="Club d'accueil" name="toClubId" required defaultValue={clubs.length === 1 ? clubs[0].id : ""} errors={fe?.toClubId}>
        {clubs.length !== 1 && <option value="">— Choisir —</option>}
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Type" name="type" value={type} onChange={(e) => setType(e.target.value as TransferType)} errors={fe?.type}>
        {TRANSFER_TYPES.map((t) => (
          <option key={t} value={t}>
            {TRANSFER_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      {type !== "FREE" && (
        <TextField label="Indemnité (FCFA)" name="fee" type="number" inputMode="numeric" min={0} step={1} defaultValue={0} errors={fe?.fee} />
      )}
      {type === "LOAN" && <TextField label="Fin du prêt" name="loanEndDate" type="date" required errors={fe?.loanEndDate} />}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
          {pending ? "Enregistrement…" : "Enregistrer la demande"}
        </Button>
      </div>
    </form>
  );
}
