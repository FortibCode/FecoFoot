"use client";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_LABELS, type ArticleCategory } from "@/lib/articles";
import { useActionForm } from "@/lib/use-action-form";

export function ArticleForm({
  action,
  initial,
  teams = [],
  submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial?: { title: string; summary: string; body: string; category: ArticleCategory; nationalTeamId?: number | null };
  /** Sélections nationales (rattachement facultatif de l'article). */
  teams?: { id: number; name: string }[];
  submitLabel: string;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const fe = state?.fieldErrors;
  return (
    <form {...formProps} className="flex max-w-3xl flex-col gap-4">
      <TextField label="Titre" name="title" required defaultValue={initial?.title} errors={fe?.title} />
      <SelectField label="Rubrique" name="category" defaultValue={initial?.category ?? "COMMUNIQUE"} errors={fe?.category}>
        {ARTICLE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {ARTICLE_CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Sélection concernée (facultatif)" name="nationalTeamId" defaultValue={initial?.nationalTeamId ? String(initial.nationalTeamId) : ""} hint="L'article apparaît aussi dans les actualités de la page de la sélection">
        <option value="">Aucune</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Chapô (résumé, partage sur les réseaux sociaux)
        <textarea name="summary" required rows={2} maxLength={400} defaultValue={initial?.summary} className="rounded-md border px-3 py-2 text-sm" />
        {fe?.summary && <span className="text-xs font-normal text-destructive">{fe.summary[0]}</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Texte
        <textarea name="body" required rows={14} defaultValue={initial?.body} className="rounded-md border px-3 py-2 font-mono text-sm" />
        <span className="text-xs font-normal text-muted-foreground">
          Mise en forme : <code>## Intertitre</code> · <code>**gras**</code> · <code>*italique*</code> · <code>[texte](https://lien)</code> · lignes
          commençant par <code>- </code> pour une liste · ligne vide entre deux paragraphes.
        </span>
        {fe?.body && <span className="text-xs font-normal text-destructive">{fe.body[0]}</span>}
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="h-10 w-fit">
        {submitLabel}
      </Button>
    </form>
  );
}
