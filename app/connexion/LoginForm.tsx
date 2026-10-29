"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { login } from "./actions";

const field =
  "h-12 w-full rounded-lg border border-transparent bg-muted pr-3 pl-11 text-base outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-[var(--flag-green)] focus:bg-background focus-visible:ring-2 focus-visible:ring-[var(--flag-green)]/25";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-foreground/60" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

export function LoginForm() {
  const { state, pending, formProps } = useActionForm(login);
  const [show, setShow] = useState(false);

  return (
    <form {...formProps} className="flex flex-col gap-4">
      <label className="relative block">
        <span className="sr-only">Adresse e-mail</span>
        <Icon d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
        <input name="email" type="email" autoComplete="username" required placeholder="Adresse e-mail" defaultValue={state?.email} className={field} />
      </label>
      <label className="relative block">
        <span className="sr-only">Mot de passe</span>
        <Icon d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V7zm2 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
        <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Mot de passe" className={`${field} pr-24`} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-bold tracking-wide text-[var(--flag-green)] uppercase hover:bg-background"
        >
          {show ? "Masquer" : "Afficher"}
        </button>
      </label>
      <div className="-mt-1 flex justify-end">
        <Link href="/mot-de-passe-oublie" className="text-xs font-semibold text-[var(--flag-green)] hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-lg text-base font-semibold shadow-md transition motion-safe:hover:-translate-y-0.5 hover:shadow-lg">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
