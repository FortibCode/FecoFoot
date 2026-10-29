import { describe, expect, it } from "vitest";
import { clubAttended, formatGrantNumber, grantTransitionError, justification, registrationError, trainingDays } from "@/lib/programs";

describe("formations", () => {
  it("liste les jours de la formation", () => {
    expect(trainingDays("2026-11-16", "2026-11-18")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(trainingDays("2026-11-16", "2026-11-16")).toEqual(["2026-11-16"]);
  });
  it("contrôle les inscriptions", () => {
    const base = { open: true, capacity: 80, registered: 10, duplicate: false, role: "CLUB_PRESIDENT" as const, forClub: true, forLeague: false };
    expect(registrationError(base)).toBeNull();
    expect(registrationError({ ...base, open: false })).toContain("closes");
    expect(registrationError({ ...base, registered: 80 })).toContain("complète");
    expect(registrationError({ ...base, duplicate: true })).toContain("déjà inscrite");
    expect(registrationError({ ...base, forClub: false })).toContain("club");
    expect(registrationError({ ...base, role: "LEAGUE_PRESIDENT", forClub: false })).toContain("ligue");
  });
  it("un club est représenté s'il a un dirigeant présent", () => {
    const regs = [
      { clubId: 1, status: "REGISTERED" as const, presentDays: [] },
      { clubId: 2, status: "REGISTERED" as const, presentDays: ["2026-11-16"] },
      { clubId: 3, status: "CANCELLED" as const, presentDays: ["2026-11-16"] },
    ];
    expect(clubAttended(regs, 1)).toBe(false);
    expect(clubAttended(regs, 2)).toBe(true);
    expect(clubAttended(regs, 3)).toBe(false);
  });
});

describe("subventions", () => {
  const ctx = { hasConvention: true, hasSignedConvention: true, justified: 0, amount: 1_000_000 };
  it("suit le cycle convention → versement → clôture", () => {
    expect(grantTransitionError("DRAFT", "sign", ctx)).toBeNull();
    expect(grantTransitionError("DRAFT", "sign", { ...ctx, hasSignedConvention: false })).toContain("signée");
    expect(grantTransitionError("DRAFT", "sign", { ...ctx, hasConvention: false })).toContain("convention de la fédération");
    expect(grantTransitionError("DRAFT", "pay", ctx)).toContain("signature");
    expect(grantTransitionError("SIGNED", "pay", ctx)).toBeNull();
    expect(grantTransitionError("PAID", "close", ctx)).toContain("insuffisantes");
    expect(grantTransitionError("PAID", "close", { ...ctx, justified: 1_000_000 })).toBeNull();
    expect(grantTransitionError("CLOSED", "cancel", ctx)).not.toBeNull();
    expect(grantTransitionError("PAID", "cancel", ctx)).toBeNull();
  });
  it("calcule la justification", () => {
    const j = justification(1_000_000, [
      { amount: 400_000, status: "ACCEPTED" },
      { amount: 250_000, status: "SUBMITTED" },
      { amount: 100_000, status: "REJECTED" },
    ]);
    expect(j).toEqual({ accepted: 400_000, pending: 250_000, remaining: 600_000, rate: 40 });
    expect(formatGrantNumber(2026, 7)).toBe("SUB-2026-0007");
  });
});
