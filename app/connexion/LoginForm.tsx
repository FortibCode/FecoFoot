"use client";

import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { login } from "./actions";

export function LoginForm() {
  const { state, pending, formProps } = useActionForm(login);

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Adresse e-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Mot de passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
