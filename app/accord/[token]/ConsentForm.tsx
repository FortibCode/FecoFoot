"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/use-action-form";
import { FormMessage, TextField } from "@/components/ui/field";
import type { ConsentAnswerState } from "./actions";

export function ConsentForm({
  action,
  guardian,
  playerName,
  clubName,
}: {
  action: (state: ConsentAnswerState, formData: FormData) => Promise<ConsentAnswerState>;
  guardian: boolean;
  playerName: string;
  clubName: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const [refusing, setRefusing] = useState(false);

  if (state?.done === "ACCEPTED") {
    return (
      <p role="status" className="rounded-lg border p-4">
        Merci. Votre accord a été enregistré : {playerName} peut être licencié(e) au club {clubName}. Cet accord est valable 5 ans.
      </p>
    );
  }
  if (state?.done === "REFUSED") {
    return (
      <p role="status" className="rounded-lg border p-4">
        Votre refus a été enregistré et transmis au club. Aucune licence ne pourra être validée sans accord.
      </p>
    );
  }

  const checkbox = "mt-0.5 size-5 shrink-0 accent-[var(--flag-green)]";
  return (
    <form {...formProps} className="flex flex-col gap-5">
      <TextField
        label={`Date de naissance ${guardian ? "de l'enfant" : ""} (pour vérifier votre identité)`}
        name="birthDate"
        type="date"
        required
      />

      {!refusing && (
        <fieldset className="flex flex-col gap-3 text-sm">
          <legend className="mb-2 font-semibold">Déclarations</legend>
          <label className="flex gap-3">
            <input type="checkbox" name="playForClub" required className={checkbox} />
            <span>
              {guardian ? `J'autorise ${playerName} à` : "J'accepte de"} jouer pour le club <strong>{clubName}</strong> et d’être licencié(e) à
              la FECOFOOT.
            </span>
          </label>
          <label className="flex gap-3">
            <input type="checkbox" name="dataProcessing" required className={checkbox} />
            <span>
              J’accepte que la FECOFOOT et le club traitent les données personnelles {guardian ? "de l'enfant" : ""} pour la gestion des licences
              et des compétitions.
            </span>
          </label>
          {guardian && (
            <label className="flex gap-3">
              <input type="checkbox" name="legalGuardian" required className={checkbox} />
              <span>Je certifie être le représentant légal de {playerName}.</span>
            </label>
          )}
        </fieldset>
      )}

      {refusing && <TextField label="Motif du refus" name="refusalReason" required minLength={3} />}

      <FormMessage state={state} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="decision" value={refusing ? "refuse" : "accept"} disabled={pending} variant={refusing ? "destructive" : "default"} className="h-11">
          {refusing ? "Confirmer le refus" : "Je donne mon accord"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setRefusing((r) => !r)}>
          {refusing ? "Revenir à l'accord" : "Je refuse"}
        </Button>
      </div>
    </form>
  );
}
