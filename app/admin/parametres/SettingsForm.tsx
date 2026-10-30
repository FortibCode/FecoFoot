"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { SOCIAL_LABELS, SOCIAL_NETWORKS, type SocialNetwork } from "@/lib/site-settings";
import { useActionForm } from "@/lib/use-action-form";

type Values = { foundedYear: number | null; headquarters: string | null; affiliations: string | null } & Record<SocialNetwork, string | null>;

const PLACEHOLDERS: Record<SocialNetwork, string> = {
  facebook: "https://www.facebook.com/…",
  instagram: "https://www.instagram.com/…",
  x: "https://x.com/…",
  youtube: "https://www.youtube.com/…",
};

/** Paramètres du portail : la fédération (page « La Fédération ») et ses comptes officiels (pied de page). */
export function SettingsForm({ action, values }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; values: Values }) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="flex max-w-3xl flex-col gap-8">
      <fieldset className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <legend className="mb-3 font-heading text-lg font-bold">La fédération</legend>
        <TextField label="Fondée en" name="foundedYear" inputMode="numeric" defaultValue={values.foundedYear ?? ""} errors={fe?.foundedYear} />
        <TextField label="Affiliations" name="affiliations" maxLength={160} defaultValue={values.affiliations ?? ""} placeholder="FIFA · CAF · UNIFFAC" errors={fe?.affiliations} />
        <TextField label="Siège" name="headquarters" maxLength={240} defaultValue={values.headquarters ?? ""} className="sm:col-span-2" errors={fe?.headquarters} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 font-heading text-lg font-bold">Réseaux sociaux officiels</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2">Affichés dans le pied de page de toutes les pages publiques. Laissez vide un réseau sans compte officiel.</p>
        {SOCIAL_NETWORKS.map((n) => (
          <TextField key={n} label={SOCIAL_LABELS[n]} name={n} type="url" defaultValue={values[n] ?? ""} placeholder={PLACEHOLDERS[n]} errors={fe?.[n]} />
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
