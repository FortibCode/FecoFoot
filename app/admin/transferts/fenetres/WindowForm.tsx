"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

export function WindowForm({ action, season }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; season: number }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-4">
      <input type="hidden" name="season" value={season} />
      <TextField label="Nom" name="name" required placeholder="Fenêtre d'été" className="sm:col-span-2" errors={fe?.name} />
      <TextField label="Ouverture" name="opensOn" type="date" required errors={fe?.opensOn} />
      <TextField label="Clôture" name="closesOn" type="date" required errors={fe?.closesOn} />
      <div className="flex flex-col gap-2 sm:col-span-4">
        <FormMessage state={state} />
        <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
          Ajouter la fenêtre
        </Button>
      </div>
    </form>
  );
}
