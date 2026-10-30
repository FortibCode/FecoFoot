"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { ID_DOCUMENT_LABELS, ID_DOCUMENT_TYPES } from "@/lib/supporters";
import { EVENT_KIND_LABELS, EVENT_KINDS } from "@/lib/ticketing";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

type Rencontre = { value: string; label: string };

/** Choix de la rencontre concernée (matchs à venir). */
function RencontreSelect({ fixtures, current }: { fixtures: Rencontre[]; current?: string }) {
  return (
    <SelectField label="Rencontre concernée" name="rencontre" defaultValue={current ?? ""} hint="La page publique du match proposera « Acheter un billet » pendant la vente" className="sm:col-span-2">
      <option value="">Aucune (événement indépendant)</option>
      {current && !fixtures.some((f) => f.value === current) && <option value={current}>Rencontre actuellement reliée (passée)</option>}
      {fixtures.map((f) => (
        <option key={f.value} value={f.value}>
          {f.label}
        </option>
      ))}
    </SelectField>
  );
}

/** Rencontre concernée par un événement existant. */
export function MatchLinkForm({ action, fixtures, current }: { action: Action; fixtures: Rencontre[]; current?: string }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <RencontreSelect fixtures={fixtures} current={current} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
          Relier à la rencontre
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EventForm({ action, fixtures = [] }: { action: Action; fixtures?: Rencontre[] }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Intitulé" name="title" required placeholder="Congo – Gabon (éliminatoires)" className="sm:col-span-2" errors={fe?.title} />
      <SelectField label="Type" name="kind" defaultValue="NATIONAL_TEAM">
        {EVENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {EVENT_KIND_LABELS[k]}
          </option>
        ))}
      </SelectField>
      <TextField label="Date et heure (Brazzaville)" name="kickoffAt" type="datetime-local" required errors={fe?.kickoffAt} />
      <TextField label="Stade" name="venue" required defaultValue="Stade Alphonse Massamba-Débat" className="sm:col-span-2" errors={fe?.venue} />
      <RencontreSelect fixtures={fixtures} />
      <TextField label="Billets maximum par Fan ID" name="maxTicketsPerFan" type="number" min={1} max={20} defaultValue={4} required />
      <TextField label="Points de fidélité du match" name="attendancePoints" type="number" min={0} max={100} defaultValue={1} required />
      <TextField label="Débit max. par porte (entrées / min)" name="gateFlowLimit" type="number" min={1} max={1000} defaultValue={30} required />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Créer l&apos;événement
        </Button>
      </div>
    </form>
  );
}

export function CategoryForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-5 sm:items-end">
      <TextField label="Tribune" name="name" required placeholder="Tribune d'honneur" errors={fe?.name} />
      <TextField label="Porte" name="gate" required placeholder="Porte A" errors={fe?.gate} />
      <TextField label="Capacité" name="capacity" type="number" min={1} required errors={fe?.capacity} />
      <TextField label="Prix public" name="publicPrice" type="number" min={0} required errors={fe?.publicPrice} />
      <TextField label="Prix membre" name="memberPrice" type="number" min={0} required errors={fe?.memberPrice} />
      <div className="flex flex-col gap-2 sm:col-span-5">
        <FormMessage state={state} />
        <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
          Ajouter la tribune
        </Button>
      </div>
    </form>
  );
}

export function CounterForm({ action, categories }: { action: Action; categories: { id: number; label: string }[] }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const [quantity, setQuantity] = useState(1);
  const [newFan, setNewFan] = useState(false);
  // Après une vente réussie, le formulaire repart à zéro pour le client suivant (champs et options).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) {
      setNewFan(false);
      setQuantity(1);
    }
  }
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <SelectField label="Type" name="channel" defaultValue="COUNTER">
        <option value="COUNTER">Vente au guichet (espèces)</option>
        <option value="INVITATION">Invitation (gratuite)</option>
      </SelectField>
      <TextField label="Téléphone du Fan ID" name="phone" type="tel" required placeholder="06 123 45 67" />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={newFan} onChange={(e) => setNewFan(e.target.checked)} className="size-5" /> Pas encore de Fan ID : le créer sur présentation de la pièce d&apos;identité
      </label>
      {newFan && (
        <>
          <TextField label="Nom" name="lastName" required />
          <TextField label="Prénom" name="firstName" required />
          <TextField label="Date de naissance" name="birthDate" type="date" required />
          <SelectField label="Pièce présentée" name="idDocumentType" defaultValue="CNI">
            {ID_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ID_DOCUMENT_LABELS[t]}
              </option>
            ))}
          </SelectField>
          <TextField label="Numéro de la pièce" name="idDocumentNumber" required />
        </>
      )}
      {!newFan && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="idChecked" className="size-5" /> Pièce d&apos;identité vérifiée (obligatoire au premier achat d&apos;un Fan ID créé en ligne)
        </label>
      )}
      <SelectField label="Tribune" name="categoryId" required defaultValue={categories[0]?.id}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </SelectField>
      <SelectField label="Nombre de billets" name="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </SelectField>
      {Array.from({ length: quantity - 1 }, (_, i) => (
        <TextField key={i} label={`Porteur du billet ${i + 2}`} name={`holder_${i + 1}`} required minLength={3} />
      ))}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
