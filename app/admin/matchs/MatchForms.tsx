"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { EVENT_TYPE_LABELS, EVENT_TYPES, MATCH_STATUS_LABELS, MATCH_STATUSES } from "@/lib/competitions";
import { OFFICIAL_ROLE_LABELS, OFFICIAL_ROLES } from "@/lib/referees";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;
type PlayerOption = { id: number; label: string; team: string };

export function ScheduleForm({ action, kickoff, venue }: { action: Action; kickoff: string; venue: string }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <TextField label="Date et heure (Brazzaville)" name="kickoffAt" type="datetime-local" defaultValue={kickoff} />
      <TextField label="Stade" name="venue" defaultValue={venue} />
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Programmer
      </Button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function SheetForm({
  action,
  values,
  cup,
}: {
  action: Action;
  values: { status: string; attendance: number | null; report: string | null; homePenalties: number | null; awayPenalties: number | null };
  cup: boolean;
}) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <SelectField label="Statut du match" name="status" defaultValue={values.status}>
        {MATCH_STATUSES.map((s) => (
          <option key={s} value={s}>
            {MATCH_STATUS_LABELS[s]}
          </option>
        ))}
      </SelectField>
      <TextField label="Affluence" name="attendance" type="number" inputMode="numeric" min={0} defaultValue={values.attendance ?? ""} />
      {cup && (
        <>
          <TextField label="Tirs au but — domicile" name="homePenalties" type="number" inputMode="numeric" min={0} defaultValue={values.homePenalties ?? ""} />
          <TextField label="Tirs au but — extérieur" name="awayPenalties" type="number" inputMode="numeric" min={0} defaultValue={values.awayPenalties ?? ""} />
        </>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Rapport du match
        <textarea name="report" rows={4} defaultValue={values.report ?? ""} className="rounded-md border px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-11 w-full sm:w-fit">
          Enregistrer la feuille de match
        </Button>
      </div>
    </form>
  );
}

export function EventForm({ action, players }: { action: Action; players: PlayerOption[] }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const teams = [...new Set(players.map((p) => p.team))];
  return (
    <form {...formProps} className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-[1fr_6rem_1.5fr_auto] sm:items-end">
      <SelectField label="Événement" name="type" defaultValue="GOAL">
        {EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {EVENT_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextField label="Minute" name="minute" type="number" inputMode="numeric" min={1} max={130} required />
      <SelectField label="Joueur" name="playerId" required defaultValue="" className="col-span-2 sm:col-span-1">
        <option value="">— Choisir —</option>
        {teams.map((team) => (
          <optgroup key={team} label={team}>
            {players
              .filter((p) => p.team === team)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>
      <Button type="submit" variant="outline" disabled={pending} className="col-span-2 h-11 sm:col-span-1 sm:h-10">
        Ajouter
      </Button>
      <div className="col-span-2 sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DesignationForm({ action, referees }: { action: Action; referees: { id: number; label: string }[] }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
      <SelectField label="Fonction" name="role" defaultValue="REFEREE">
        {OFFICIAL_ROLES.map((r) => (
          <option key={r} value={r}>
            {OFFICIAL_ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Officiel" name="refereeId" required defaultValue="">
        <option value="">— Choisir —</option>
        {referees.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Désigner
      </Button>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
