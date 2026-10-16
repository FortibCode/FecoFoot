"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import { useActionForm } from "@/lib/use-action-form";
import { verifyTwoFactor } from "./actions";

export function VerifyForm() {
  const { state, pending, formProps } = useActionForm(verifyTwoFactor);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <TextField
        label="Code à 6 chiffres"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
      />
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? "Vérification…" : "Valider"}
      </Button>
    </form>
  );
}
