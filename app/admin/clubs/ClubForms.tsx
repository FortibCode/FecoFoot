"use client";

import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { CLUB_STATUS_LABELS, CLUB_STATUSES, type ClubStatus } from "@/lib/clubs";
import type { Option } from "@/lib/queries/reference";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

type ClubValues = {
  name: string;
  shortName: string | null;
  leagueId: number | null;
  city: string;
  stadium: string | null;
  colors: string | null;
  foundedYear: number | null;
  email: string | null;
  phone: string | null;
};

export function ClubForm({
  action,
  leagues,
  initial,
  submitLabel,
}: {
  action: Action;
  /** Une seule ligue proposée quand l'utilisateur est un compte de ligue. */
  leagues: Option[];
  initial?: ClubValues;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;

  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Nom du club" name="name" required defaultValue={initial?.name} errors={fe?.name} />
      <TextField label="Sigle" name="shortName" defaultValue={initial?.shortName ?? ""} errors={fe?.shortName} hint="Ex. CARA, JST" />
      <SelectField
        label="Rattachement"
        name="leagueId"
        required
        defaultValue={initial ? (initial.leagueId ?? "national") : leagues.length === 1 ? leagues[0].id : ""}
        errors={fe?.leagueId}
      >
        {leagues.length > 1 && (
          <>
            <option value="">— Choisir —</option>
            {/* Clubs des divisions nationales (Ligue 1 / Ligue 2 National) : rattachés directement à la fédération. */}
            <option value="national">Fédération — division nationale</option>
          </>
        )}
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Ville" name="city" required defaultValue={initial?.city} errors={fe?.city} />
      <TextField label="Stade" name="stadium" defaultValue={initial?.stadium ?? ""} errors={fe?.stadium} />
      <TextField label="Couleurs" name="colors" defaultValue={initial?.colors ?? ""} errors={fe?.colors} hint="Ex. rouge et noir" />
      <TextField label="Année de fondation" name="foundedYear" type="number" inputMode="numeric" defaultValue={initial?.foundedYear ?? ""} errors={fe?.foundedYear} />
      <TextField label="E-mail" name="email" type="email" defaultValue={initial?.email ?? ""} errors={fe?.email} />
      <TextField label="Téléphone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} errors={fe?.phone} />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function StatusForm({ action, current }: { action: Action; current: ClubStatus }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex max-w-md flex-col gap-3">
      <div className="flex items-end gap-2">
        <SelectField label="Statut d'affiliation" name="status" defaultValue={current} className="flex-1">
          {CLUB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLUB_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="outline" disabled={pending} className="h-10">
          Appliquer
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function OfficialForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <TextField label="Nom complet" name="fullName" required errors={fe?.fullName} />
      <TextField label="Fonction" name="position" required errors={fe?.position} hint="Président, secrétaire général, entraîneur…" />
      <TextField label="E-mail" name="email" type="email" errors={fe?.email} />
      <TextField label="Téléphone" name="phone" type="tel" errors={fe?.phone} />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
          Ajouter le dirigeant
        </Button>
      </div>
    </form>
  );
}
