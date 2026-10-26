"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { PRESS_ROLE_LABELS, PRESS_ROLES, PRESS_ZONE_LABELS, PRESS_ZONES } from "@/lib/accreditations";
import { useActionForm } from "@/lib/use-action-form";

export function RequestForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="lastName" required errors={fe?.lastName} />
      <TextField label="Prénom" name="firstName" required errors={fe?.firstName} />
      <TextField label="Téléphone" name="phone" type="tel" required placeholder="06 123 45 67" errors={fe?.phone} />
      <TextField label="E-mail" name="email" type="email" errors={fe?.email} />
      <TextField label="Organe de presse" name="outlet" required errors={fe?.outlet} />
      <SelectField label="Fonction" name="role" defaultValue="JOURNALIST">
        {PRESS_ROLES.map((r) => (
          <option key={r} value={r}>
            {PRESS_ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <TextField label="N° de carte de presse" name="pressCardNumber" required errors={fe?.pressCardNumber} className="sm:col-span-2" />
      <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
        Photo d&apos;identité (pour le badge)
        <input type="file" name="photo" accept="image/jpeg,image/png" required className="text-sm font-normal file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-2 file:font-semibold" />
        <span className="text-xs font-normal text-muted-foreground">Photo de face, visage dégagé, comme sur une pièce d&apos;identité. JPEG ou PNG, 5 Mo au plus.</span>
        {fe?.photo && <span className="text-xs font-normal text-destructive">{fe.photo[0]}</span>}
      </label>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-semibold">Zones demandées</legend>
        {PRESS_ZONES.map((z) => (
          <label key={z} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="zones" value={z} defaultChecked={z === "PRESS_BOX"} className="size-5 accent-[var(--flag-green)]" /> {PRESS_ZONE_LABELS[z]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          Envoyer la demande
        </Button>
      </div>
    </form>
  );
}
