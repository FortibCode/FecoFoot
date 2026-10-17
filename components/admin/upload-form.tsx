"use client";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { MAX_FILE_SIZE, type DocumentType } from "@/lib/documents";
import { useActionForm } from "@/lib/use-action-form";

export function UploadForm({
  action,
  type,
  accept,
  label,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Type de pièce (documents des joueurs et clubs) ; absent pour un simple visuel. */
  type?: DocumentType;
  accept: string;
  label: string;
}) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });

  return (
    <form {...formProps} className="flex flex-col gap-1">
      {type && <input type="hidden" name="type" value={type} />}
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept={accept}
          required
          aria-label={`${label} : fichier`}
          className="max-w-52 text-xs file:mr-2 file:rounded file:border file:bg-background file:px-2 file:py-1"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.setCustomValidity(f && f.size > MAX_FILE_SIZE ? "Le fichier dépasse 5 Mo." : "");
          }}
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Envoi…" : label}
        </Button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
