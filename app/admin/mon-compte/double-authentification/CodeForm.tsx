"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

export function CodeForm({
  action,
  submitLabel,
  variant = "default",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex max-w-sm flex-col gap-3">
      <TextField label="Code à 6 chiffres" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
      <FormMessage state={state} />
      <Button type="submit" variant={variant} disabled={pending} className="h-10 w-fit">
        {submitLabel}
      </Button>
    </form>
  );
}
