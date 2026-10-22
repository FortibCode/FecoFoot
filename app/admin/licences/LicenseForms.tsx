"use client";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

/**
 * Validation d'une licence : si l'identité n'a pas encore été contrôlée, l'agent confirme l'avoir contrôlée
 * sur pièces (photo, acte de naissance ou pièce d'identité) — la confirmation est tracée à son nom.
 */
export function ValidateLicenseForm({ action, identityVerified }: { action: Action; identityVerified: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2 rounded-lg border p-3">
      {!identityVerified && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="identityChecked" required className="mt-0.5 size-4 accent-[var(--flag-green)]" />
          <span>J&apos;ai contrôlé l&apos;identité du joueur : la photo et les pièces justificatives correspondent à la personne.</span>
        </label>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
        {pending ? "…" : "Valider la licence"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

/** Choix de publication recueillis auprès du joueur (ou de son représentant légal). */
export function PublicationForm({ action, initial }: { action: Action; initial: { publishPhoto: boolean; showBirthDate: boolean } }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" name="publishPhoto" defaultChecked={initial.publishPhoto} className="mt-0.5 size-4 accent-[var(--flag-green)]" />
        <span>Photo visible sur la page publique de vérification (QR code)</span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="showBirthDate" defaultChecked={initial.showBirthDate} className="mt-0.5 size-4 accent-[var(--flag-green)]" />
        <span>Date de naissance imprimée sur la carte de licence</span>
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
        Enregistrer les choix
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
