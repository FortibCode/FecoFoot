"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { POSITION_LABELS, POSITIONS } from "@/lib/licenses";
import { FIXTURE_STATUS_LABELS, FIXTURE_STATUSES } from "@/lib/national-teams";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/competitions";
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

/** Nouveau groupe d'une compétition internationale : compétition, saison, groupe, qualifiés, pays. */
export function GroupForm({ action, season }: { action: Action; season: number }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <TextField label="Compétition" name="competition" required placeholder="Ex. Éliminatoires de la CAN" errors={fe?.competition} />
      <TextField label="Saison (année de début)" name="season" type="number" required defaultValue={String(season)} errors={fe?.season} />
      <TextField label="Groupe" name="name" required placeholder="Ex. Groupe G" errors={fe?.name} />
      <TextField label="Places qualificatives" name="qualifiers" type="number" min={0} max={10} defaultValue="2" errors={fe?.qualifiers} />
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
        Pays du groupe (un par ligne ou séparés par des virgules ; le Congo est ajouté d&apos;office)
        <textarea name="countries" rows={3} required placeholder={"Cameroun\nComores\nNamibie"} className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit pending={pending} label="Créer le groupe" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Rattachement d'un match du Congo à un groupe et à une journée. */
export function FixtureGroupForm({ action, groups, current }: { action: Action; groups: { id: number; label: string }[]; current: { groupId: number | null; matchday: number | null } }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-1 text-xs">
      <select name="groupId" defaultValue={current.groupId ?? ""} aria-label="Groupe" className="h-8 max-w-48 rounded border px-1">
        <option value="">Sans groupe</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
      </select>
      <input name="matchday" type="number" min={1} max={20} defaultValue={current.matchday ?? ""} aria-label="Journée" placeholder="J." className="h-8 w-14 rounded border px-1" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Rattacher
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

/** Match du groupe entre deux autres pays. */
export function GroupMatchForm({ action, teams }: { action: Action; teams: string[] }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const others = teams.filter((t) => t !== "Congo");
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[6rem_1fr_1fr]">
      <TextField label="Journée" name="matchday" type="number" min={1} max={20} required />
      <SelectField label="Domicile" name="home" defaultValue={others[0]}>
        {others.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </SelectField>
      <SelectField label="Extérieur" name="away" defaultValue={others[1]}>
        {others.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </SelectField>
      <TextField label="Date et heure (Brazzaville)" name="kickoffAt" type="datetime-local" />
      <TextField label="Stade" name="venue" className="sm:col-span-2" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Submit pending={pending} label="Ajouter le match" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Résultat d'un match entre deux autres pays du groupe. */
export function GroupMatchResultForm({ action, current }: { action: Action; current: { status: string; homeGoals: number | null; awayGoals: number | null } }) {
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
      <input name="homeGoals" type="number" min={0} defaultValue={current.homeGoals ?? ""} aria-label="Buts domicile" className="h-8 w-12 rounded border px-1" />
      –
      <input name="awayGoals" type="number" min={0} defaultValue={current.awayGoals ?? ""} aria-label="Buts extérieur" className="h-8 w-12 rounded border px-1" />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        OK
      </Button>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </form>
  );
}

type LineupRow = { id: number; name: string; club: string; position: string | null; shirtNumber: number | null; role: "none" | "starter" | "sub"; captain: boolean };

/**
 * Composition du Congo parmi les convoqués : rôle (titulaire, remplaçant), numéro, poste, capitaine,
 * système de jeu et publication sur la fiche du match.
 */
export function NationalLineupForm({ action, rows, formation, published }: { action: Action; rows: LineupRow[]; formation: string | null; published: boolean }) {
  const { state, pending, formProps } = useActionForm(action);
  const [roles, setRoles] = useState(() => new Map(rows.map((r) => [r.id, r.role])));
  const [captain, setCaptain] = useState<number | null>(() => rows.find((r) => r.captain)?.id ?? null);
  const starters = [...roles.values()].filter((r) => r === "starter").length;
  const subs = [...roles.values()].filter((r) => r === "sub").length;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <TextField label="Système de jeu" name="formation" defaultValue={formation ?? ""} placeholder="4-3-3" className="w-36" />
        <p className="pb-2 text-sm">
          <strong className={starters === 11 ? "" : "text-destructive"}>{starters}/11 titulaires</strong> · {subs} remplaçant{subs > 1 ? "s" : ""}
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => {
          const role = roles.get(r.id) ?? "none";
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <strong>{r.name}</strong> <span className="text-xs text-muted-foreground">{r.club}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <select aria-label={`Rôle de ${r.name}`} value={role} onChange={(e) => setRoles((prev) => new Map(prev).set(r.id, e.target.value as LineupRow["role"]))} className="h-9 rounded-md border px-2">
                  <option value="none">—</option>
                  <option value="starter">Titulaire</option>
                  <option value="sub">Remplaçant</option>
                </select>
                <select name={`pos_${r.id}`} defaultValue={r.position ?? ""} aria-label={`Poste de ${r.name}`} disabled={role === "none"} className="h-9 rounded-md border px-2">
                  <option value="">Poste</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABELS[p]}
                    </option>
                  ))}
                </select>
                <input name={`shirt_${r.id}`} type="number" min={1} max={99} defaultValue={r.shirtNumber ?? ""} disabled={role === "none"} aria-label={`Numéro de ${r.name}`} placeholder="N°" className="h-9 w-16 rounded-md border px-2" />
                <label className={`flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${role === "starter" ? "" : "invisible"}`}>
                  <input type="radio" name="captainId" value={r.id} checked={captain === r.id && role === "starter"} onChange={() => setCaptain(r.id)} disabled={role !== "starter"} className="accent-[var(--flag-green)]" />
                  Capitaine
                </label>
                {role !== "none" && <input type="hidden" name="entryIds" value={r.id} />}
                {role === "starter" && <input type="hidden" name={`starter_${r.id}`} value="on" />}
              </span>
            </li>
          );
        })}
      </ul>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="published" defaultChecked={published} className="size-5 accent-[var(--flag-green)]" /> Publier la composition sur la fiche du match
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} label="Enregistrer la composition" variant="default" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Événement d'un match des sélections : type, minute, équipe, joueur, passeur ou joueur entrant. */
export function NationalEventForm({ action, congoPlayers, opponent }: { action: Action; congoPlayers: string[]; opponent: string }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  const [type, setType] = useState("GOAL");
  const second = type === "SUBSTITUTION" ? "Joueur entrant" : type === "GOAL" || type === "PENALTY_GOAL" ? "Passeur décisif (facultatif)" : null;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-[1fr_6rem_1fr]">
      <SelectField label="Événement" name="type" value={type} onChange={(e) => setType(e.target.value)}>
        {EVENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {EVENT_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextField label="Minute" name="minute" type="number" min={1} max={130} required errors={fe?.minute} />
      <SelectField label="Équipe" name="side" defaultValue="CONGO">
        <option value="CONGO">Congo</option>
        <option value="OPPONENT">{opponent}</option>
      </SelectField>
      <TextField label="Joueur" name="player" required list="joueurs-congo" errors={fe?.player} className="sm:col-span-2" />
      {second && <TextField label={second} name="secondPlayer" list="joueurs-congo" />}
      <datalist id="joueurs-congo">
        {congoPlayers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Submit pending={pending} label="Ajouter l'événement" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Présentation de la sélection (page publique). */
export function TeamDescriptionForm({ action, description }: { action: Action; description: string | null }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex max-w-3xl flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Présentation de la sélection
        <textarea name="description" rows={5} maxLength={4000} defaultValue={description ?? ""} placeholder="Histoire, palmarès, ambitions, sélectionneur…" className="rounded-md border bg-background px-3 py-2 font-normal" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} label="Enregistrer la présentation" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Lien vidéo (YouTube, Facebook) de la sélection. */
export function TeamVideoForm({ action }: { action: Action }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-3xl gap-3 sm:grid-cols-2">
      <TextField label="Titre de la vidéo" name="title" required errors={fe?.title} />
      <TextField label="Adresse (YouTube ou Facebook)" name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…" errors={fe?.url} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit pending={pending} label="Ajouter la vidéo" />
        <FormMessage state={state} />
      </div>
    </form>
  );
}
