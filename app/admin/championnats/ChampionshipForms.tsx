"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { seasonLabel } from "@/lib/licenses";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

/** Présentation d'un championnat : nom, informations officielles, visibilité sur le portail. */
export function ChampionshipForm({ action, initial }: { action: Action; initial: { name: string; description: string | null; active: boolean } }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-3xl gap-3">
      <TextField label="Nom" name="name" required defaultValue={initial.name} errors={state?.fieldErrors?.name} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Informations officielles
        <textarea name="description" rows={4} maxLength={5000} defaultValue={initial.description ?? ""} className="rounded-md border px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="active" defaultChecked={initial.active} className="size-5 accent-[var(--flag-green)]" /> Visible sur le portail
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          Enregistrer
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Nouvelle saison : année de début, nom (facultatif), reprise des clubs d'après les statuts sportifs. */
export function SeasonForm({ action, suggested, defaultName, hasPrevious }: { action: Action; suggested: number; defaultName: string; hasPrevious: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[10rem_1fr]">
      <SelectField label="Saison" name="season" defaultValue={suggested} errors={state?.fieldErrors?.season}>
        {[suggested - 1, suggested, suggested + 1].map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </SelectField>
      <TextField label="Nom de la saison" name="name" placeholder={defaultName} hint={`Par défaut : ${defaultName}`} />
      {hasPrevious && (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="carryClubs" defaultChecked className="mt-0.5 size-5 accent-[var(--flag-green)]" />
          <span>
            Proposer les clubs de la saison précédente : maintenus, promus du niveau inférieur et relégués du niveau supérieur, d&apos;après les statuts sportifs
            saisis. Les engagements restent modifiables avant la génération du calendrier.
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Créer la saison
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Responsable : fonction, coordonnées, début de mandat ; rattaché à ce championnat ou à la structure commune. */
export function OfficialForm({ action, championship }: { action: Action; championship: { id: number; name: string } }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <SelectField label="Rattachement" name="championshipId" defaultValue={championship.id}>
        <option value={championship.id}>{championship.name} uniquement</option>
        <option value="">Structure commune aux championnats nationaux</option>
      </SelectField>
      <TextField label="Nom complet" name="fullName" required errors={fe?.fullName} />
      <TextField label="Fonction" name="position" required placeholder="Ex. Président de la commission" errors={fe?.position} />
      <TextField label="Début du mandat" name="startDate" type="date" required errors={fe?.startDate} />
      <TextField label="E-mail" name="email" type="email" errors={fe?.email} />
      <TextField label="Téléphone" name="phone" type="tel" errors={fe?.phone} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          Ajouter le responsable
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EndMandateForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <input type="date" name="endDate" required aria-label="Fin du mandat" className="h-8 rounded border px-2" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Clore le mandat
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

/** Document officiel ou règlement (PDF), d'une saison ou permanent. */
export function DocumentForm({ action, seasons }: { action: Action; seasons: number[] }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[1fr_10rem]">
      <TextField label="Titre" name="title" required placeholder="Règlement de la saison" errors={state?.fieldErrors?.title} />
      <SelectField label="Saison" name="season" defaultValue="">
        <option value="">Toutes (permanent)</option>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </SelectField>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Fichier PDF (10 Mo au plus)
        <input type="file" name="file" accept="application/pdf" required className="text-sm file:mr-2 file:rounded file:border file:bg-background file:px-2 file:py-1" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Envoi…" : "Publier le document"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
