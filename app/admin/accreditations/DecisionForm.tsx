"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { PRESS_ROLE_LABELS, PRESS_ROLES, PRESS_ZONE_LABELS, PRESS_ZONES, type PressRole, type PressZone } from "@/lib/accreditations";
import { formatCongoPhone } from "@/lib/supporters";
import { useActionForm } from "@/lib/use-action-form";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function DecisionForm({
  approve,
  refuse,
  requested,
  who,
  approveLabel = "Approuver",
  refuseLabel = "Refuser",
}: {
  approve: Action;
  refuse: Action;
  /** Zones cochées au départ : demandées (nouvelle demande) ou accordées (badge déjà délivré). */
  requested: PressZone[];
  who: string;
  approveLabel?: string;
  refuseLabel?: string;
}) {
  const ok = useActionForm(approve);
  const ko = useActionForm(refuse);
  return (
    <div className="flex flex-col gap-2">
      <form {...ok.formProps} className="flex flex-wrap items-center gap-3 text-xs">
        {PRESS_ZONES.map((z) => (
          <label key={z} className="flex items-center gap-1">
            <input type="checkbox" name="zones" value={z} defaultChecked={requested.includes(z)} aria-label={`${PRESS_ZONE_LABELS[z]} pour ${who}`} /> {PRESS_ZONE_LABELS[z]}
          </label>
        ))}
        <Button type="submit" size="sm" disabled={ok.pending}>
          {approveLabel}
        </Button>
      </form>
      <form {...ko.formProps} className="flex flex-wrap items-center gap-2 text-xs">
        <input name="reason" placeholder="Motif" aria-label={`Motif du refus pour ${who}`} className="h-8 w-40 rounded border px-2" />
        <Button type="submit" size="sm" variant="destructive" disabled={ko.pending}>
          {refuseLabel}
        </Button>
      </form>
      <FormMessage state={ok.state ?? ko.state} />
    </div>
  );
}

export function QuotaForm({ action, quotas }: { action: Action; quotas: Partial<Record<PressZone, number>> }) {
  const { state, pending, formProps } = useActionForm(action);
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3 text-sm">
      {PRESS_ZONES.map((z) => (
        <label key={z} className="flex flex-col gap-1">
          {PRESS_ZONE_LABELS[z]}
          <input name={`quota_${z}`} type="number" min={0} defaultValue={quotas[z] ?? ""} placeholder="illimité" className="h-9 w-28 rounded-md border px-2" />
        </label>
      ))}
      <Button type="submit" variant="outline" disabled={pending} className="h-9">
        Enregistrer les quotas
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

type Values = { lastName: string; firstName: string; phone: string; email: string | null; outlet: string; role: PressRole; pressCardNumber: string | null };

/** Fiche d'un membre de la presse : identité, contacts, média, fonction, carte de presse. */
export function AccreditationForm({ action, initial }: { action: Action; initial: Values }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="lastName" required defaultValue={initial.lastName} errors={fe?.lastName} />
      <TextField label="Prénom" name="firstName" required defaultValue={initial.firstName} errors={fe?.firstName} />
      <TextField label="Téléphone" name="phone" type="tel" required defaultValue={formatCongoPhone(initial.phone)} errors={fe?.phone} />
      <TextField label="E-mail" name="email" type="email" defaultValue={initial.email ?? ""} errors={fe?.email} />
      <TextField label="Organe de presse" name="outlet" required defaultValue={initial.outlet} errors={fe?.outlet} />
      <SelectField label="Fonction" name="role" defaultValue={initial.role}>
        {PRESS_ROLES.map((r) => (
          <option key={r} value={r}>
            {PRESS_ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <TextField label="N° de carte de presse" name="pressCardNumber" defaultValue={initial.pressCardNumber ?? ""} hint="Vide si accrédité sur ordre de mission du média." errors={fe?.pressCardNumber} />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" disabled={pending} className="h-10 w-fit">
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
