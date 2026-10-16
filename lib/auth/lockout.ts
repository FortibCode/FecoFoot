/** Verrouillage temporaire après échecs de connexion — EF-AUT-06. */

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** Nouvel état du compte après un mot de passe erroné. */
export function registerFailure(
  failedLoginCount: number,
  now: Date = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const count = failedLoginCount + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) };
  }
  return { failedLoginCount: count, lockedUntil: null };
}
