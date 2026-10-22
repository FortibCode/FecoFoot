"use client";

import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

type LeagueFields = {
  code: string;
  name: string;
  department: string | null;
  description: string | null;
  president: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * Fiche d'une ligue. `identity` : la fédération modifie aussi le code, le nom et le département ;
 * sinon (responsable départemental) seules la présentation et les coordonnées sont modifiables.
 */
export function LeagueForm({
  action,
  initial,
  identity = true,
  submitLabel = "Enregistrer la ligue",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: LeagueFields;
  identity?: boolean;
  submitLabel?: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-6">
      {identity && (
        <>
          <TextField label="Code" name="code" required maxLength={8} placeholder="BZV" defaultValue={initial?.code ?? ""} errors={fe?.code} className="sm:col-span-1" hint="2 à 8 lettres" />
          <TextField label="Nom de la ligue" name="name" required placeholder="Ligue départementale de …" defaultValue={initial?.name ?? ""} errors={fe?.name} className="sm:col-span-3" />
          <TextField label="Département" name="department" placeholder="Brazzaville" defaultValue={initial?.department ?? ""} errors={fe?.department} className="sm:col-span-2" />
        </>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-6">
        Présentation
        <textarea
          name="description"
          rows={4}
          maxLength={3000}
          defaultValue={initial?.description ?? ""}
          placeholder="Histoire, missions, siège, informations utiles aux clubs et au public."
          className="rounded-md border px-3 py-2 text-sm"
        />
        {fe?.description?.map((e) => (
          <span key={e} className="text-xs font-normal text-destructive">
            {e}
          </span>
        ))}
      </label>
      <TextField label="Président" name="president" defaultValue={initial?.president ?? ""} errors={fe?.president} className="sm:col-span-2" />
      <TextField label="E-mail" name="email" type="email" defaultValue={initial?.email ?? ""} errors={fe?.email} className="sm:col-span-2" />
      <TextField label="Téléphone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} errors={fe?.phone} className="sm:col-span-2" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
