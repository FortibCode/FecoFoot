"use client";

import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Une décision sur un dossier : bouton seul, ou bouton + un champ (motif, avis, référence de paiement). */
export function ActionForm({
  action,
  label,
  variant = "outline",
  field,
}: {
  action: Action;
  label: string;
  variant?: "default" | "outline" | "destructive";
  field?: { name: string; label: string; required?: boolean };
}) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2 rounded-lg border p-3">
      {field && <TextField label={field.label} name={field.name} required={field.required} />}
      <Button type="submit" variant={variant} disabled={pending} className="h-10 w-full sm:w-fit">
        {pending ? "…" : label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
