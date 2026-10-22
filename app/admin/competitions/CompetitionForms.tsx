"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  COMPETITION_GENDER_LABELS,
  COMPETITION_TYPE_LABELS,
  COMPETITION_TYPES,
  DEFAULT_TIEBREAKERS,
  TEAM_OUTCOME_LABELS,
  TEAM_OUTCOMES,
  TIEBREAKER_LABELS,
  TIEBREAKERS,
  type Tiebreaker,
} from "@/lib/competitions";
import { seasonLabel } from "@/lib/licenses";
import type { Option } from "@/lib/queries/reference";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

type CompetitionValues = {
  name: string;
  season: number;
  type: string;
  category: string;
  gender: string;
  leagueId: number | null;
  doubleRound: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreakers: string[];
  promotionSpots: number;
  relegationSpots: number;
};

/**
 * Création ou modification d'une compétition. `leagues` vide : l'organisateur est imposé
 * (compte de ligue). `locked` : calendrier généré, le format ne change plus.
 */
export function CompetitionForm({
  action,
  season,
  leagues,
  initial,
  locked = false,
  submitLabel = "Créer la compétition",
}: {
  action: Action;
  season: number;
  leagues: Option[] | null;
  initial?: CompetitionValues;
  locked?: boolean;
  submitLabel?: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [type, setType] = useState(initial?.type ?? "LEAGUE");
  const fe = state?.fieldErrors;
  const seasons = [...new Set([initial?.season ?? season, season, season + 1])].sort();
  const chosen = initial?.tiebreakers ?? DEFAULT_TIEBREAKERS;
  // Critères cochés d'abord, dans leur ordre d'application, puis les autres.
  const ordered = [...chosen, ...TIEBREAKERS.filter((t) => !chosen.includes(t))] as Tiebreaker[];
  return (
    <form {...formProps} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="name" required placeholder="Championnat départemental de Brazzaville" defaultValue={initial?.name} className="sm:col-span-2" errors={fe?.name} />
      {leagues && (
        <SelectField label="Organisateur" name="leagueId" defaultValue={initial?.leagueId ?? ""} className="sm:col-span-2" errors={fe?.leagueId}>
          <option value="">Fédération — compétition nationale</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField label="Saison" name="season" defaultValue={initial?.season ?? season} disabled={locked}>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {seasonLabel(s)}
          </option>
        ))}
      </SelectField>
      {locked && <input type="hidden" name="season" value={initial?.season} />}
      <SelectField label="Type" name="type" value={type} onChange={(e) => setType(e.target.value)} disabled={locked}>
        {COMPETITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {COMPETITION_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      {locked && <input type="hidden" name="type" value={type} />}
      <SelectField label="Catégorie" name="category" defaultValue={initial?.category ?? "SENIOR"}>
        {COMPETITION_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {COMPETITION_CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Genre" name="gender" defaultValue={initial?.gender ?? "M"}>
        {Object.entries(COMPETITION_GENDER_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </SelectField>
      {type === "LEAGUE" && (
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" name="doubleRound" defaultChecked={initial?.doubleRound ?? true} disabled={locked} className="size-5 accent-[var(--flag-green)]" /> Matchs aller et retour
          {locked && initial?.doubleRound && <input type="hidden" name="doubleRound" value="on" />}
        </label>
      )}
      <fieldset className="grid grid-cols-3 gap-3 sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">Barème de points</legend>
        <TextField label="Victoire" name="pointsWin" type="number" defaultValue={initial?.pointsWin ?? 3} required />
        <TextField label="Nul" name="pointsDraw" type="number" defaultValue={initial?.pointsDraw ?? 1} required />
        <TextField label="Défaite" name="pointsLoss" type="number" defaultValue={initial?.pointsLoss ?? 0} required />
      </fieldset>
      {type === "LEAGUE" && (
        <fieldset className="grid grid-cols-2 gap-3 sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Montées et descentes (par poule, selon le règlement de la saison)</legend>
          <TextField label="Places de montée" name="promotionSpots" type="number" min={0} max={20} defaultValue={initial?.promotionSpots ?? 0} />
          <TextField label="Places de descente" name="relegationSpots" type="number" min={0} max={20} defaultValue={initial?.relegationSpots ?? 0} />
        </fieldset>
      )}
      {type === "LEAGUE" && (
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-semibold">Départage à égalité de points</legend>
          <p className="text-xs text-muted-foreground">Cochez les critères du règlement, appliqués dans l&apos;ordre de la liste. Aucun critère coché : différence de buts puis buts marqués.</p>
          {ordered.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tiebreakers" value={t} defaultChecked={chosen.includes(t)} className="size-4 accent-[var(--flag-green)]" />
              {TIEBREAKER_LABELS[t]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Ajout manuel d'une rencontre entre deux clubs engagés. */
export function FixtureForm({ action, clubs, nextRound }: { action: Action; clubs: Option[]; nextRound: number }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
      <TextField label="Journée" name="round" type="number" min={1} defaultValue={nextRound} required />
      <SelectField label="Reçoit" name="homeClubId" required defaultValue="">
        <option value="">— Choisir —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <SelectField label="Se déplace" name="awayClubId" required defaultValue="">
        <option value="">— Choisir —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Ajouter le match
      </Button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function EngageForm({ action, clubs, pools }: { action: Action; clubs: Option[]; pools: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <SelectField label="Club affilié" name="clubId" required defaultValue="" className="sm:w-72">
        <option value="">— Choisir —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      {pools && <TextField label="Poule (facultatif)" name="pool" maxLength={8} placeholder="A" className="sm:w-32" />}
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Engager
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

/** Statut sportif d'un club dans la saison. */
export function OutcomeForm({ action, current }: { action: Action; current: string | null }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <select name="outcome" defaultValue={current ?? ""} aria-label="Statut sportif" className="h-8 rounded border px-2">
        <option value="">Statut sportif —</option>
        {TEAM_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {TEAM_OUTCOME_LABELS[o]}
          </option>
        ))}
      </select>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        OK
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

export function PenaltyForm({ action, current }: { action: Action; current: number }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <input name="points" type="number" min={0} max={100} defaultValue={current} aria-label="Points de pénalité" className="h-8 w-16 rounded border px-2" />
      <input name="reason" placeholder="Motif" aria-label="Motif de la pénalité" className="h-8 w-32 rounded border px-2" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Pénalité
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

export function StatusSelectForm({
  action,
  current,
  options,
  label,
}: {
  action: Action;
  current: string;
  options: Record<string, string>;
  label: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2">
      <SelectField label={label} name="status" defaultValue={current}>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        Appliquer
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
