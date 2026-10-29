"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

/** Nouvelle subvention : club, formation de référence, programme, montant (FCFA). */
export function GrantForm({ action, clubs, trainings }: { action: Action; clubs: { id: number; name: string; attended: number[] }[]; trainings: { id: number; title: string }[] }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  // Présence indiquée pour la formation choisie.
  const [trainingId, setTrainingId] = useState<number | null>(trainings[0]?.id ?? null);
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <SelectField label="Club bénéficiaire" name="clubId" defaultValue="">
        <option value="">Choisir…</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {trainingId !== null ? (c.attended.includes(trainingId) ? " — présent à la formation" : " — absent de la formation") : ""}
          </option>
        ))}
      </SelectField>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Formation de référence
        <select name="trainingId" value={trainingId ?? ""} onChange={(e) => setTrainingId(e.target.value ? Number(e.target.value) : null)} className="h-10 rounded-md border bg-background px-2 font-normal">
          <option value="">Aucune</option>
          {trainings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Programme" name="programme" required defaultValue="Subvention exceptionnelle 2026" errors={fe?.programme} />
      <TextField label="Montant (FCFA)" name="amount" type="number" required errors={fe?.amount} />
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Note interne
        <textarea name="note" rows={2} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Créer la subvention
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Versement : date et référence (virement, chèque, Mobile Money). */
export function PayForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3">
      <TextField label="Date du versement" name="paidAt" type="date" required errors={fe?.paidAt} />
      <TextField label="Référence" name="paymentRef" required placeholder="N° de virement ou de chèque" errors={fe?.paymentRef} />
      <Button type="submit" disabled={pending}>
        Enregistrer le versement
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

/** Justificatif : objet, montant, date, pièce (PDF ou photo). */
export function ExpenseForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-3">
      <TextField label="Objet de la dépense" name="label" required placeholder="Ex. Équipements d'entraînement" errors={fe?.label} className="sm:col-span-3" />
      <TextField label="Montant (FCFA)" name="amount" type="number" required errors={fe?.amount} />
      <TextField label="Date" name="spentOn" type="date" required errors={fe?.spentOn} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Facture ou reçu (PDF, JPEG, PNG)
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" required className="text-sm font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Déposer le justificatif
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
