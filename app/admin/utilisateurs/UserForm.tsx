"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { ROLE_LABELS, ROLES, ROLES_MANAGED_ELSEWHERE, type Role } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { Option } from "@/lib/queries/reference";

type UserValues = {
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  leagueId: number | null;
  clubId: number | null;
};

export function UserForm({
  action,
  leagues,
  clubs,
  initial,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  leagues: Option[];
  clubs: Option[];
  initial?: UserValues;
  submitLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [role, setRole] = useState<Role>(initial?.role ?? "CLUB");
  const fe = state?.fieldErrors;

  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Nom complet" name="fullName" required defaultValue={initial?.fullName} errors={fe?.fullName} />
      <TextField label="Adresse e-mail" name="email" type="email" required defaultValue={initial?.email} errors={fe?.email} />
      <TextField label="Téléphone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} errors={fe?.phone} />
      <SelectField
        label="Profil"
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        errors={fe?.role}
      >
        {ROLES.filter((r) => !ROLES_MANAGED_ELSEWHERE.includes(r) || r === initial?.role).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>

      {role === "LEAGUE" && (
        <SelectField label="Ligue" name="leagueId" required defaultValue={initial?.leagueId ?? ""} errors={fe?.leagueId}>
          <option value="">— Choisir —</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      )}
      {role === "CLUB" && (
        <SelectField
          label="Club"
          name="clubId"
          required
          defaultValue={initial?.clubId ?? ""}
          errors={fe?.clubId}
          hint={clubs.length === 0 ? "Aucun club enregistré : créez d'abord le club." : undefined}
        >
          <option value="">— Choisir —</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}

      {!initial && (
        <TextField
          label="Mot de passe initial"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`${MIN_PASSWORD_LENGTH} caractères minimum, avec lettres et chiffres.`}
          errors={fe?.password}
        />
      )}

      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-fit">
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  return (
    <form {...formProps} className="flex max-w-md flex-col gap-3">
      <TextField
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
      />
      <FormMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-fit">
        Réinitialiser le mot de passe
      </Button>
    </form>
  );
}
