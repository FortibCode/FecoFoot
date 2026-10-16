"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ConsentRequestState } from "./actions";

export function ConsentRequestButton({
  action,
  label,
}: {
  action: (state: ConsentRequestState) => Promise<ConsentRequestState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <Button type="submit" variant="outline" disabled={pending} className="h-10">
          {pending ? "Envoi…" : label}
        </Button>
      </form>
      <FormMessage state={state} />
      {state?.link && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={state.link} className="h-10 flex-1 rounded-md border bg-muted px-3 font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
          >
            {copied ? "Copié" : "Copier le lien"}
          </Button>
        </div>
      )}
    </div>
  );
}
