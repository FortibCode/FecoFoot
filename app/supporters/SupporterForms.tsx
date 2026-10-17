"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { MIN_SUPPORTER_PASSWORD_LENGTH } from "@/lib/auth/password";
import { formatFcfa } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments-rules";
import { ID_DOCUMENT_LABELS, ID_DOCUMENT_TYPES, MEMBERSHIP_TIER_LABELS, type MembershipTier } from "@/lib/supporters";
import { useActionForm } from "@/lib/use-action-form";
import { loginSupporter, registerSupporter, startMembership } from "./actions";

export function SignupForm() {
  const { state, pending, formProps } = useActionForm(registerSupporter);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="grid gap-4 sm:grid-cols-2">
      <TextField label="Nom" name="lastName" required autoComplete="family-name" errors={fe?.lastName} />
      <TextField label="Prénom" name="firstName" required autoComplete="given-name" errors={fe?.firstName} />
      <TextField label="Date de naissance" name="birthDate" type="date" required errors={fe?.birthDate} />
      <TextField
        label="Téléphone Mobile Money"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="06 123 45 67"
        hint="Airtel (05) ou MTN (06) : il sert d'identifiant et au paiement."
        errors={fe?.phone}
      />
      <SelectField label="Pièce d'identité" name="idDocumentType" required defaultValue="CNI" errors={fe?.idDocumentType}>
        {ID_DOCUMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {ID_DOCUMENT_LABELS[t]}
          </option>
        ))}
      </SelectField>
      <TextField label="Numéro de la pièce" name="idDocumentNumber" required errors={fe?.idDocumentNumber} />
      <TextField label="E-mail (facultatif)" name="email" type="email" autoComplete="email" errors={fe?.email} />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_SUPPORTER_PASSWORD_LENGTH}
        hint={`${MIN_SUPPORTER_PASSWORD_LENGTH} caractères minimum, avec lettres et chiffres.`}
        errors={fe?.password}
      />
      <label className="flex gap-3 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--flag-green)]" />
        <span>
          J&apos;accepte que la FECOFOOT conserve ces informations pour la gestion de mon Fan ID, de mes billets et de mon accès au stade. Mon
          identité pourra être vérifiée à l&apos;entrée. Mes billets sont nominatifs et ne peuvent pas être revendus.
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <Button type="submit" size="lg" disabled={pending} className="h-11">
          {pending ? "Création…" : "Créer mon Fan ID"}
        </Button>
      </div>
    </form>
  );
}

export function FanLoginForm() {
  const { state, pending, formProps } = useActionForm(loginSupporter);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <TextField label="Téléphone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={state?.phone} placeholder="06 123 45 67" />
      <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

export function MembershipForm({
  plans,
  defaultMethod,
}: {
  plans: { tier: MembershipTier; price: number; allowed: boolean }[];
  defaultMethod: PaymentMethod | null;
}) {
  const { state, pending, formProps } = useActionForm(startMembership);
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Formule</legend>
        {plans.map((p, i) => (
          <label key={p.tier} className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${p.allowed ? "" : "opacity-50"}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="tier" value={p.tier} defaultChecked={i === 0 && p.allowed} disabled={!p.allowed} className="size-5" />
              {MEMBERSHIP_TIER_LABELS[p.tier]}
            </span>
            <strong>{formatFcfa(p.price)}</strong>
          </label>
        ))}
      </fieldset>
      <SelectField label="Payer avec" name="method" defaultValue={defaultMethod ?? "MTN_MOMO"}>
        {(["MTN_MOMO", "AIRTEL_MONEY"] as const).map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </SelectField>
      <FormMessage state={state} />
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? "…" : "Adhérer et payer"}
      </Button>
    </form>
  );
}
