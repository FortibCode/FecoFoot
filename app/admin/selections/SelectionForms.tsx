"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { POSITION_LABELS, POSITIONS } from "@/lib/licenses";
import { FIXTURE_STATUS_LABELS, FIXTURE_STATUSES } from "@/lib/national-teams";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

function Submit({ pending, label, variant = "outline" }: { pending: boolean; label: string; variant?: "outline" | "default" }) {
  return (
    <Button type="submit" variant={variant} disabled={pending} className="h-10 w-fit">
      {label}
    </Button>
  );
}

export function StaffForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <TextField label="Nom complet" name="fullName" required />
      <TextField label="Fonction" name="role" required placeholder="Sélectionneur, adjoint, entraîneur des gardiens…" />
      <Submit pending={pending} label="Ajouter" />
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function FixtureForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <TextField label="Adversaire" name="opponent" required />
      <TextField label="Date et heure (Brazzaville)" name="kickoffAt" type="datetime-local" required />
      <TextField label="Stade" name="venue" />
      <TextField label="Compétition" name="competition" placeholder="Éliminatoires CAN, match amical…" />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="isHome" defaultChecked className="size-5 accent-[var(--flag-green)]" /> À domicile
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Submit pending={pending} label="Ajouter au calendrier" />
      </div>
    </form>
  );
}

export function FixtureResultForm({ action, current }: { action: Action; current: { status: string; goalsFor: number | null; goalsAgainst: number | null } }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <select name="status" defaultValue={current.status} aria-label="Statut" className="h-8 rounded border px-1">
        {FIXTURE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {FIXTURE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <input name="goalsFor" type="number" min={0} defaultValue={current.goalsFor ?? ""} aria-label="Buts Congo" className="h-8 w-12 rounded border px-1" />
      –
      <input name="goalsAgainst" type="number" min={0} defaultValue={current.goalsAgainst ?? ""} aria-label="Buts adversaire" className="h-8 w-12 rounded border px-1" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        OK
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

export function SelectionCreateForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <TextField label="Intitulé" name="title" required placeholder="Stage de préparation — octobre 2026" className="sm:col-span-2" />
      <TextField label="Date de regroupement" name="gatheringDate" type="date" />
      <TextField label="Lieu" name="location" />
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Objet
        <textarea name="purpose" rows={2} className="rounded-md border px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Submit pending={pending} label="Créer la liste" variant="default" />
      </div>
    </form>
  );
}

export function CallUpForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const [abroad, setAbroad] = useState(false);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <div className="flex gap-4 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="radio" name="origin" checked={!abroad} onChange={() => setAbroad(false)} /> Joueur du registre national
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="origin" checked={abroad} onChange={() => setAbroad(true)} /> Joueur évoluant à l&apos;étranger
        </label>
      </div>
      {abroad ? (
        <>
          <TextField label="Nom complet" name="externalName" required className="sm:col-span-2" />
          <TextField label="Club" name="externalClub" required />
          <TextField label="Pays" name="externalCountry" required />
        </>
      ) : (
        <TextField label="Identifiant fédéral" name="federalId" required placeholder="FCF-J-2026-000001" className="sm:col-span-2" />
      )}
      <SelectField label="Poste" name="position" defaultValue="">
        <option value="">{abroad ? "—" : "Poste de la fiche"}</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {POSITION_LABELS[p]}
          </option>
        ))}
      </SelectField>
      <TextField label="Numéro" name="shirtNumber" type="number" min={1} max={99} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Submit pending={pending} label="Ajouter à la liste" />
      </div>
    </form>
  );
}
