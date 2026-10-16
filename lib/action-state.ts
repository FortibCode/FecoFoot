import type * as z from "zod";

/** Résultat renvoyé par les Server Actions de formulaire (utilisé avec useActionState). */
export type ActionState =
  | {
      error?: string;
      success?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export function fromZodError(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { error: "Certains champs sont invalides.", fieldErrors };
}

/**
 * Normalise un champ facultatif : absent du formulaire (champ masqué) ou vide → null.
 * À utiliser avec z.preprocess pour les champs facultatifs.
 */
export const blankToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);
