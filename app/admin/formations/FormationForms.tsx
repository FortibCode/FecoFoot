"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { TRAINING_ROLE_LABELS, TRAINING_ROLES, type TrainingRole } from "@/lib/programs";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;
type Option = { id: number; name: string };
type TrainingValues = {
  title: string;
  organizer: string;
  location: string;
  startDate: string;
  endDate: string;
  capacity: number | null;
  description: string | null;
  modules: string[];
  registrationOpen: boolean;
};

/** Formation : titre, organisateur, lieu, dates, places, modules (un par ligne), inscriptions ouvertes. */
export function TrainingForm({ action, initial, submitLabel }: { action: Action; initial?: TrainingValues; submitLabel: string }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TextField label="Titre" name="title" required defaultValue={initial?.title} errors={fe?.title} className="sm:col-span-2" />
      <TextField label="Organisateur" name="organizer" required defaultValue={initial?.organizer ?? "FIFA · FECOFOOT"} errors={fe?.organizer} />
      <TextField label="Lieu" name="location" required defaultValue={initial?.location ?? "Brazzaville"} errors={fe?.location} />
      <TextField label="Début" name="startDate" type="date" required defaultValue={initial?.startDate} errors={fe?.startDate} />
      <TextField label="Fin" name="endDate" type="date" required defaultValue={initial?.endDate} errors={fe?.endDate} />
      <TextField label="Places" name="capacity" type="number" defaultValue={initial?.capacity ? String(initial.capacity) : ""} errors={fe?.capacity} />
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input type="checkbox" name="registrationOpen" defaultChecked={initial?.registrationOpen ?? true} className="size-5 accent-[var(--flag-green)]" /> Inscriptions ouvertes
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Modules (un par ligne)
        <textarea name="modules" rows={5} defaultValue={initial?.modules.join("\n")} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Présentation
        <textarea name="description" rows={3} defaultValue={initial?.description ?? ""} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/**
 * Inscription d'un dirigeant. La fédération choisit le club ou la ligue ; un club ou une ligue
 * inscrit les siens (structure fixée côté serveur).
 */
export function RegistrationForm({ action, scope, clubs, leagues }: { action: Action; scope: "federation" | "club" | "league"; clubs: Option[]; leagues: Option[] }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  const roles: TrainingRole[] = scope === "club" ? ["CLUB_PRESIDENT", "CLUB_SECRETARY", "OTHER"] : scope === "league" ? ["LEAGUE_PRESIDENT", "OTHER"] : [...TRAINING_ROLES];
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <TextField label="Nom complet" name="fullName" required placeholder="NOM Prénom" errors={fe?.fullName} />
      <SelectField label="Fonction" name="role" defaultValue={roles[0]}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {TRAINING_ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      {scope === "federation" && (
        <>
          <SelectField label="Club (dirigeant de club)" name="clubId" defaultValue="">
            <option value="">—</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Ligue (président de ligue)" name="leagueId" defaultValue="">
            <option value="">—</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        </>
      )}
      <TextField label="Téléphone" name="phone" type="tel" errors={fe?.phone} />
      <TextField label="E-mail" name="email" type="email" errors={fe?.email} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Inscrire
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Case de présence d'un jour (pointage par la fédération). */
export function AttendanceToggle({ action, present, label }: { action: () => Promise<ActionState>; present: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={present}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action();
          router.refresh();
        })
      }
      className={`grid size-8 place-items-center rounded-md border text-sm font-bold transition-colors ${present ? "border-[var(--flag-green)] bg-[var(--flag-green)] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
    >
      {present ? "✓" : "–"}
    </button>
  );
}
