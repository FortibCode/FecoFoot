"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { CameraIcon, GroupIcon, IdCardIcon, MicIcon, PhoneIcon, UserIcon } from "@/components/public/icons";
import type { ActionState } from "@/lib/action-state";
import { PRESS_ROLE_LABELS, PRESS_ROLES, PRESS_ZONE_LABELS, PRESS_ZONES, type PressZone } from "@/lib/accreditations";
import { useActionForm } from "@/lib/use-action-form";

/** Ce que donne chaque zone : pictogramme et explication sous son nom. */
const ZONE_DETAILS: Record<PressZone, { icon: ReactNode; text: string }> = {
  PRESS_BOX: { icon: <IdCardIcon className="size-5" />, text: "Place en tribune de presse pour suivre et commenter le match." },
  PITCHSIDE: { icon: <CameraIcon className="size-5" />, text: "Accès au bord du terrain, réservé aux photographes et cadreurs." },
  MIXED_ZONE: { icon: <MicIcon className="size-5" />, text: "Interviews des joueurs après le match." },
  PRESS_CONFERENCE: { icon: <GroupIcon className="size-5" />, text: "Conférences d'avant et d'après-match des sélectionneurs." },
};

/** Étape numérotée du formulaire : pastille, titre, aide, champs. */
function Step({ n, icon, title, hint, children }: { n: number; icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 bg-muted/60 p-5 sm:p-6">
      <legend className="sr-only">
        Étape {n} : {title}
      </legend>
      <div aria-hidden className="flex items-start gap-3">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-[var(--flag-green)] text-white">
          {icon}
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-brand-ink text-[0.65rem] font-bold">{n}</span>
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-lg font-bold">{title}</span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </span>
      </div>
      {children}
    </fieldset>
  );
}

/** Photo d'identité : zone d'envoi avec aperçu de la photo choisie (elle figurera sur le badge). */
function PhotoField({ error }: { error?: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  return (
    <label className="group flex cursor-pointer items-center gap-4 border-2 border-dashed border-foreground/15 bg-card p-4 transition-colors hover:border-[var(--flag-green)] focus-within:border-[var(--flag-green)]">
      <span className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden bg-muted text-muted-foreground">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local du fichier choisi
          <img src={preview} alt="Aperçu de la photo d'identité" className="size-full object-cover" />
        ) : (
          <UserIcon className="size-9" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="font-semibold">Photo d&apos;identité (pour le badge)</span>
        <span className="text-muted-foreground">Photo de face, visage dégagé, comme sur une pièce d&apos;identité. JPEG ou PNG, 5 Mo au plus.</span>
        <span className="mt-1 inline-flex w-fit items-center bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-[var(--flag-green)]">
          {preview ? "Changer de photo" : "Choisir une photo"}
        </span>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </span>
      <input
        type="file"
        name="photo"
        accept="image/jpeg,image/png"
        required
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
    </label>
  );
}

/** Demande d'accréditation en quatre étapes : identité, contact, média, zones d'accès (EF-MED-01). */
export function RequestForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="flex flex-col gap-4">
      <Step n={1} icon={<UserIcon className="size-5" />} title="Identité" hint="Telle qu'elle figure sur votre carte de presse.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nom" name="lastName" required autoComplete="family-name" errors={fe?.lastName} />
          <TextField label="Prénom" name="firstName" required autoComplete="given-name" errors={fe?.firstName} />
        </div>
        <PhotoField error={fe?.photo?.[0]} />
      </Step>

      <Step n={2} icon={<PhoneIcon className="size-5" />} title="Contact" hint="Pour vous joindre au sujet de votre demande.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Téléphone" name="phone" type="tel" required autoComplete="tel" placeholder="06 123 45 67" errors={fe?.phone} />
          <TextField label="E-mail (facultatif)" name="email" type="email" autoComplete="email" errors={fe?.email} />
        </div>
      </Step>

      <Step n={3} icon={<IdCardIcon className="size-5" />} title="Média" hint="Votre organe de presse et votre fonction le jour du match.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Organe de presse" name="outlet" required autoComplete="organization" errors={fe?.outlet} />
          <SelectField label="Fonction" name="role" defaultValue="JOURNALIST">
            {PRESS_ROLES.map((r) => (
              <option key={r} value={r}>
                {PRESS_ROLE_LABELS[r]}
              </option>
            ))}
          </SelectField>
          <TextField label="N° de carte de presse" name="pressCardNumber" required errors={fe?.pressCardNumber} className="sm:col-span-2" />
        </div>
      </Step>

      <Step n={4} icon={<GroupIcon className="size-5" />} title="Zones d'accès" hint="Cochez les zones dont vous avez besoin ; elles sont accordées selon les places.">
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESS_ZONES.map((z) => (
            <label
              key={z}
              className="group flex cursor-pointer items-start gap-3 border-2 border-transparent bg-card p-4 transition-colors hover:border-[color-mix(in_srgb,var(--flag-green)_40%,transparent)] has-[:checked]:border-[var(--flag-green)] has-[:checked]:bg-[color-mix(in_srgb,var(--flag-green)_6%,var(--card))]"
            >
              <input type="checkbox" name="zones" value={z} defaultChecked={z === "PRESS_BOX"} className="mt-0.5 size-5 shrink-0 accent-[var(--flag-green)]" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="text-[var(--flag-green)]">{ZONE_DETAILS[z].icon}</span>
                  {PRESS_ZONE_LABELS[z]}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{ZONE_DETAILS[z].text}</span>
              </span>
            </label>
          ))}
        </div>
      </Step>

      <div className="flex flex-col gap-3 bg-brand-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-sm text-white/80">En envoyant la demande, vous recevez un lien de suivi personnel : le badge y apparaît dès la validation.</p>
        <Button type="submit" size="lg" disabled={pending} className="h-11 shrink-0 bg-[var(--flag-green)] px-6 text-white hover:bg-[var(--flag-yellow)] hover:text-brand-ink">
          {pending ? "Envoi en cours…" : "Envoyer la demande"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
