"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

export function ReportForm({ action, initial }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial: string | null }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Rapport
        <textarea name="report" rows={4} required minLength={10} defaultValue={initial ?? ""} className="rounded-md border px-3 py-2 text-sm" />
      </label>
      <FormMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
        {initial ? "Mettre à jour le rapport" : "Transmettre le rapport"}
      </Button>
    </form>
  );
}
