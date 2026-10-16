"use client";

import { useActionState, useEffect, useRef, startTransition, type FormEvent } from "react";

/**
 * useActionState sans la remise à zéro automatique de React 19 : quand l'action renvoie
 * une erreur, l'utilisateur garde sa saisie. `action` reste posé sur le formulaire
 * pour fonctionner aussi sans JavaScript.
 */
export function useActionForm<S extends object>(
  action: (state: S | undefined, formData: FormData) => Promise<S | undefined>,
  options: { resetOnSuccess?: boolean } = {},
) {
  const [state, formAction, pending] = useActionState<S | undefined, FormData>(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const succeeded = Boolean((state as { success?: string } | undefined)?.success);

  useEffect(() => {
    if (options.resetOnSuccess && succeeded) ref.current?.reset();
  }, [state, succeeded, options.resetOnSuccess]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(data));
  };

  return { state, pending, formProps: { ref, action: formAction, onSubmit } };
}
