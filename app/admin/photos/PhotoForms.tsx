"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { MAX_FILE_SIZE } from "@/lib/documents";
import { useActionForm } from "@/lib/use-action-form";

type Team = { id: number; name: string };
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function TeamOptions({ teams }: { teams: Team[] }) {
  return (
    <>
      <option value="">Photo générale (sans sélection)</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </>
  );
}

/**
 * Ajout de plusieurs photos d'un coup : chaque fichier part dans sa propre requête,
 * pour rester sous la taille maximale d'un envoi et suivre la progression.
 */
export function PhotoUploader({ action, teams, defaultTeamId }: { action: Action; teams: Team[]; defaultTeamId?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return setErrors(["Choisissez au moins une photo."]);
    setErrors([]);
    startTransition(async () => {
      const failed: string[] = [];
      setProgress({ done: 0, total: files.length });
      for (const [i, file] of files.entries()) {
        if (file.size > MAX_FILE_SIZE) failed.push(`${file.name} : la photo dépasse 5 Mo.`);
        else {
          const one = new FormData();
          one.set("file", file);
          one.set("teamId", String(data.get("teamId") ?? ""));
          one.set("caption", String(data.get("caption") ?? ""));
          const result = await action(undefined, one);
          if (result?.error) failed.push(result.error);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      setErrors(failed);
      if (failed.length === 0) form.reset();
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Photos (JPEG, PNG ou WebP, 5 Mo maximum chacune)
        <input
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="rounded-md border border-dashed p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
        />
      </label>
      <SelectField label="Sélection" name="teamId" defaultValue={defaultTeamId ?? ""}>
        <TeamOptions teams={teams} />
      </SelectField>
      <TextField label="Légende commune (facultatif)" name="caption" maxLength={200} placeholder="ex. Séance d'entraînement" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} className="h-10">
          {pending && progress ? `Envoi ${progress.done}/${progress.total}…` : "Ajouter les photos"}
        </Button>
        {!pending && progress && errors.length === 0 && (
          <p role="status" className="text-sm text-[var(--flag-green)]">
            {progress.total} photo(s) ajoutée(s).
          </p>
        )}
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}

/** Légende et sélection d'une photo. */
export function PhotoDetailsForm({ action, teams, caption, teamId }: { action: Action; teams: Team[]; caption: string; teamId: number | null }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2">
      <TextField label="Légende" name="caption" defaultValue={caption} maxLength={200} />
      <SelectField label="Sélection" name="teamId" defaultValue={teamId ?? ""}>
        <TeamOptions teams={teams} />
      </SelectField>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-fit">
        Enregistrer
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

/** Bouton d'action rapide (publier, mettre à la une, supprimer). */
export function PhotoButton({ action, label, variant = "outline", confirm }: { action: Action; label: string; variant?: "outline" | "default" | "destructive"; confirm?: string }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form
      {...formProps}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) return e.preventDefault();
        formProps.onSubmit(e);
      }}
    >
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {label}
      </Button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
