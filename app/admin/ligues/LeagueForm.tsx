"use client";

import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

export function LeagueForm({
  action,
  initial,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: { president: string | null; email: string | null; phone: string | null };
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-3">
      <TextField label="Président" name="president" defaultValue={initial.president ?? ""} errors={fe?.president} />
      <TextField label="E-mail" name="email" type="email" defaultValue={initial.email ?? ""} errors={fe?.email} />
      <TextField label="Téléphone" name="phone" type="tel" defaultValue={initial.phone ?? ""} errors={fe?.phone} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Enregistrer
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
