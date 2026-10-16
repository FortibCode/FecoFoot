import { describe, expect, it } from "vitest";
import { formatTransferNumber, needsRelease, openWindow, transferRequestError, transferTransition, windowError } from "@/lib/transfers";

const now = new Date("2026-09-29T10:00:00Z");
const base = { fromClubId: 1, toClubId: 2, fee: 0, loanEndDate: null, now };

describe("Demande de transfert (EF-TRF-01)", () => {
  it("numéro TRF-AAAA-0001", () => {
    expect(formatTransferNumber(2026, 7)).toBe("TRF-2026-0007");
  });

  it("définitif avec indemnité en FCFA", () => {
    expect(transferRequestError({ ...base, type: "DEFINITIVE", fee: 500000 })).toBeNull();
    expect(transferRequestError({ ...base, type: "DEFINITIVE", fee: -1 })).toMatch(/indemnité/);
    expect(transferRequestError({ ...base, type: "DEFINITIVE", fee: 10.5 })).toMatch(/indemnité/);
  });

  it("prêt : date de fin obligatoire et future", () => {
    expect(transferRequestError({ ...base, type: "LOAN" })).toMatch(/fin de prêt/);
    expect(transferRequestError({ ...base, type: "LOAN", loanEndDate: new Date("2026-01-01") })).toMatch(/futur/);
    expect(transferRequestError({ ...base, type: "LOAN", loanEndDate: new Date("2027-06-30") })).toBeNull();
  });

  it("libre : sans indemnité ; date de fin réservée aux prêts", () => {
    expect(transferRequestError({ ...base, type: "FREE", fee: 1000 })).toMatch(/libre/);
    expect(transferRequestError({ ...base, type: "FREE", fromClubId: null })).toBeNull();
    expect(transferRequestError({ ...base, type: "FREE", loanEndDate: new Date("2027-06-30") })).toMatch(/prêt/);
  });

  it("club d'accueil différent du club actuel", () => {
    expect(transferRequestError({ ...base, type: "DEFINITIVE", toClubId: 1 })).toMatch(/différent/);
  });
});

describe("Circuit : la ligue instruit, la fédération approuve (EF-TRF-02)", () => {
  it("instruction puis approbation", () => {
    expect(transferTransition("PENDING", "forward")).toEqual({ to: "FORWARDED", permission: "transfers.review" });
    expect(transferTransition("FORWARDED", "approve")).toEqual({ to: "APPROVED", permission: "transfers.approve" });
  });

  it("pas d'approbation sans instruction", () => {
    expect(transferTransition("PENDING", "approve")).toHaveProperty("error");
  });

  it("refus par la fédération, annulation avant décision", () => {
    expect(transferTransition("FORWARDED", "refuse")).toEqual({ to: "REFUSED", permission: "transfers.approve" });
    expect(transferTransition("PENDING", "cancel")).toEqual({ to: "CANCELLED", permission: "transfers.review" });
    expect(transferTransition("APPROVED", "cancel")).toHaveProperty("error");
  });
});

describe("Accord du club quitté (EF-TRF-05)", () => {
  it("exigé pour un définitif ou un prêt depuis un club, pas pour un transfert libre", () => {
    expect(needsRelease({ type: "DEFINITIVE", fromClubId: 1 })).toBe(true);
    expect(needsRelease({ type: "LOAN", fromClubId: 1 })).toBe(true);
    expect(needsRelease({ type: "FREE", fromClubId: 1 })).toBe(false);
    expect(needsRelease({ type: "DEFINITIVE", fromClubId: null })).toBe(false);
  });

  it("pas de transmission à la fédération sans l'accord", () => {
    expect(transferTransition("PENDING", "forward", { needsRelease: true, releaseGranted: null })).toHaveProperty("error");
    expect(transferTransition("PENDING", "forward", { needsRelease: true, releaseGranted: false })).toHaveProperty("error");
    expect(transferTransition("PENDING", "forward", { needsRelease: true, releaseGranted: true })).toEqual({ to: "FORWARDED", permission: "transfers.review" });
  });
});

describe("Fenêtres de transfert (EF-TRF-04)", () => {
  const windows = [
    { name: "Été", opensOn: new Date("2026-07-01"), closesOn: new Date("2026-09-30") },
    { name: "Hiver", opensOn: new Date("2027-01-02"), closesOn: new Date("2027-01-31") },
  ];

  it("ouverte bornes incluses", () => {
    expect(openWindow(windows, new Date("2026-07-01T08:00:00Z"))?.name).toBe("Été");
    expect(openWindow(windows, new Date("2026-09-30T20:00:00Z"))?.name).toBe("Été");
    expect(openWindow(windows, new Date("2026-10-01T08:00:00Z"))).toBeNull();
  });

  it("hors fenêtre : définitif et prêt refusés, transfert libre autorisé", () => {
    const november = new Date("2026-11-15T10:00:00Z");
    expect(windowError("DEFINITIVE", windows, november)).toMatch(/fenêtre/);
    expect(windowError("LOAN", windows, november)).toMatch(/fenêtre/);
    expect(windowError("FREE", windows, november)).toBeNull();
    expect(windowError("DEFINITIVE", windows, new Date("2027-01-10T10:00:00Z"))).toBeNull();
  });
});
