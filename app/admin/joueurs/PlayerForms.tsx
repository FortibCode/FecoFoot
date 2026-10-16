"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import {
  ageAt,
  CATEGORIES,
  CATEGORY_LABELS,
  LICENSE_TYPE_LABELS,
  LICENSE_TYPES,
  POSITION_LABELS,
  POSITIONS,
  type Category,
} from "@/lib/licenses";
import type { Option } from "@/lib/queries/reference";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type PlayerValues = {
  lastName: string;
  firstName: string;
  birthDate: string;
  birthPlace: string | null;
  gender: "M" | "F";
  nationality: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  clubId: number | null;
};

export function PlayerForm({
  action,
  clubs,
  initial,
  submitLabel,
}: {
  action: Action;
  clubs: Option[];
  initial?: PlayerValues;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const minor = birthDate !== "" && ageAt(new Date(`${birthDate}T00:00:00Z`)) < 18;
  const fe = state?.fieldErrors;

  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="lastName" required defaultValue={initial?.lastName} errors={fe?.lastName} autoCapitalize="characters" />
      <TextField label="Prénom(s)" name="firstName" required defaultValue={initial?.firstName} errors={fe?.firstName} />
      <TextField
        label="Date de naissance"
        name="birthDate"
        type="date"
        required
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        errors={fe?.birthDate}
      />
      <TextField label="Lieu de naissance" name="birthPlace" defaultValue={initial?.birthPlace ?? ""} errors={fe?.birthPlace} />
      <SelectField label="Sexe" name="gender" required defaultValue={initial?.gender ?? ""} errors={fe?.gender}>
        <option value="">— Choisir —</option>
        <option value="M">Masculin</option>
        <option value="F">Féminin</option>
      </SelectField>
      <TextField label="Nationalité" name="nationality" defaultValue={initial?.nationality ?? "Congolaise"} errors={fe?.nationality} />
      <SelectField label="Poste" name="position" defaultValue={initial?.position ?? ""} errors={fe?.position}>
        <option value="">—</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {POSITION_LABELS[p]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Club"
        name="clubId"
        required
        defaultValue={initial?.clubId ?? (clubs.length === 1 ? clubs[0].id : "")}
        errors={fe?.clubId}
        disabled={Boolean(initial)}
        hint={initial ? "Le changement de club se fait par un transfert." : undefined}
      >
        {clubs.length !== 1 && <option value="">— Choisir —</option>}
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {/* Un champ désactivé n'est pas envoyé : on transmet le club inchangé. */}
      {initial?.clubId && <input type="hidden" name="clubId" value={initial.clubId} />}
      <TextField label="Téléphone du joueur" name="phone" type="tel" defaultValue={initial?.phone ?? ""} errors={fe?.phone} />
      <TextField label="E-mail du joueur" name="email" type="email" defaultValue={initial?.email ?? ""} errors={fe?.email} />

      <fieldset className="grid gap-4 rounded-lg border p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">
          Représentant légal {minor ? <span className="text-destructive">(obligatoire : joueur mineur)</span> : "(si mineur)"}
        </legend>
        <TextField label="Nom complet" name="guardianName" required={minor} defaultValue={initial?.guardianName ?? ""} errors={fe?.guardianName} className="sm:col-span-2" />
        <TextField label="Téléphone" name="guardianPhone" type="tel" defaultValue={initial?.guardianPhone ?? ""} errors={fe?.guardianPhone} />
        <TextField label="E-mail" name="guardianEmail" type="email" defaultValue={initial?.guardianEmail ?? ""} errors={fe?.guardianEmail} />
      </fieldset>

      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function LicenseRequestForm({
  action,
  suggested,
  seasonLabel,
}: {
  action: Action;
  suggested: Category;
  seasonLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <p className="text-sm text-muted-foreground sm:col-span-2">Saison {seasonLabel}</p>
      <SelectField label="Catégorie" name="category" defaultValue={suggested} errors={fe?.category} hint={`Catégorie d'âge du joueur : ${CATEGORY_LABELS[suggested]}. Surclassement d'une catégorie possible.`}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Type de licence" name="type" defaultValue="AMATEUR" errors={fe?.type}>
        {LICENSE_TYPES.map((t) => (
          <option key={t} value={t}>
            {LICENSE_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextField label="Date de la visite médicale" name="medicalCheckDate" type="date" required errors={fe?.medicalCheckDate} hint="Obligatoire, de moins d'un an." />
      <TextField label="Droits de licence (FCFA)" name="feeAmount" type="number" inputMode="numeric" min={0} step={1} required errors={fe?.feeAmount} />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
          Déposer la demande de licence
        </Button>
      </div>
    </form>
  );
}
