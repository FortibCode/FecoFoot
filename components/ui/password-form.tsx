"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { useActionForm } from "@/lib/use-action-form";

type State = { error?: string; success?: string } | undefined;

/** Formulaire « nouveau mot de passe » (réinitialisation, ou changement avec le mot de passe actuel). */
export function PasswordForm({
  action,
  askCurrent = false,
  submitLabel,
  loginLinkOnSuccess = false,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  askCurrent?: boolean;
  submitLabel: string;
  loginLinkOnSuccess?: boolean;
}) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });

  if (state?.success && loginLinkOnSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage state={state} />
        <Link href="/connexion" className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Se connecter
        </Link>
      </div>
    );
  }
  return (
    <form {...formProps} className="flex max-w-md flex-col gap-4">
      {askCurrent && <TextField label="Mot de passe actuel" name="current" type="password" autoComplete="current-password" required />}
      <TextField
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`${MIN_PASSWORD_LENGTH} caractères minimum, avec lettres et chiffres.`}
      />
      <TextField label="Confirmer le nouveau mot de passe" name="confirm" type="password" autoComplete="new-password" required />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-fit">
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
