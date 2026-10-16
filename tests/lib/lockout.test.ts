import { describe, expect, it } from "vitest";
import { isLocked, LOCK_DURATION_MS, MAX_FAILED_LOGINS, registerFailure } from "@/lib/auth/lockout";

describe("Verrouillage après échecs de connexion (EF-AUT-06)", () => {
  const now = new Date("2026-09-29T10:00:00Z");

  it("ne verrouille pas avant le 5e échec", () => {
    let state = { failedLoginCount: 0, lockedUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      state = registerFailure(state.failedLoginCount, now);
      expect(state.lockedUntil).toBeNull();
      expect(state.failedLoginCount).toBe(i);
    }
  });

  it("verrouille 15 minutes au 5e échec", () => {
    const state = registerFailure(MAX_FAILED_LOGINS - 1, now);
    expect(state.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_DURATION_MS);
    expect(isLocked(state.lockedUntil, now)).toBe(true);
    expect(isLocked(state.lockedUntil, new Date(now.getTime() + LOCK_DURATION_MS + 1))).toBe(false);
  });

  it("un compte jamais verrouillé ne l'est pas", () => {
    expect(isLocked(null, now)).toBe(false);
  });
});
