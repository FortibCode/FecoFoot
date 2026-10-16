"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import { useActionForm } from "@/lib/use-action-form";
import { requestPasswordReset } from "./actions";

export function ForgotForm() {
  const { state, pending, formProps } = useActionForm(requestPasswordReset);
  if (state?.success) return <FormMessage state={state} />;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <TextField label="Adresse e-mail du compte" name="email" type="email" autoComplete="username" required />
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? "Envoi…" : "Recevoir un lien de réinitialisation"}
      </Button>
    </form>
  );
}
