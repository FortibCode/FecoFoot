"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

/** Bouton « Synchroniser avec fecofoot.cg » et son compte rendu. */
export function SyncButton({ action }: { action: () => Promise<ActionState> }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Synchronisation…" : "Synchroniser avec fecofoot.cg"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
