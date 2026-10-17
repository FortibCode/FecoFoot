"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function PaymentButtons({ accept, refuse }: { accept: Action; refuse: Action }) {
  const ok = useActionForm(accept);
  const ko = useActionForm(refuse);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form {...ok.formProps}>
          <Button type="submit" size="lg" disabled={ok.pending || ko.pending} className="h-11 w-full sm:w-auto">
            Confirmer le paiement
          </Button>
        </form>
        <form {...ko.formProps}>
          <Button type="submit" size="lg" variant="outline" disabled={ok.pending || ko.pending} className="h-11 w-full sm:w-auto">
            Refuser
          </Button>
        </form>
      </div>
      <FormMessage state={ok.state ?? ko.state} />
    </div>
  );
}
