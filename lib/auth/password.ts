/** Politique de mot de passe des comptes internes. */

export const MIN_PASSWORD_LENGTH = 12;
/** Comptes supporters (grand public, saisie sur téléphone) : 8 caractères, lettres et chiffres. */
export const MIN_SUPPORTER_PASSWORD_LENGTH = 8;

/** Renvoie un message d'erreur, ou null si le mot de passe est acceptable. */
export function passwordPolicyError(password: string, minLength: number = MIN_PASSWORD_LENGTH): string | null {
  if (password.length < minLength) return `Le mot de passe doit faire au moins ${minLength} caractères.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  return null;
}

/** Durée de validité d'un lien de réinitialisation. */
export const RESET_LINK_TTL_MS = 60 * 60 * 1000;
