import { describe, expect, it } from "vitest";
import { badgeValidity, formatAccreditationNumber, pressCredential, pressPhotoUrl, pressProofError, quotaError, requestDeadline, requestError } from "@/lib/accreditations";

const kickoffAt = new Date("2026-10-18T15:00:00Z");

describe("Accréditations médias (EF-MED-01, EF-MED-02, RG-16)", () => {
  it("demandes closes 24 h avant le coup d'envoi", () => {
    expect(requestDeadline(kickoffAt).toISOString()).toBe("2026-10-17T15:00:00.000Z");
    expect(requestError({ kickoffAt, eventCancelled: false, zones: ["PRESS_BOX"], now: new Date("2026-10-17T14:59:00Z") })).toBeNull();
    expect(requestError({ kickoffAt, eventCancelled: false, zones: ["PRESS_BOX"], now: new Date("2026-10-17T15:00:00Z") })).toMatch(/24 h/);
  });

  it("au moins une zone connue ; pas de demande pour un match annulé", () => {
    const now = new Date("2026-10-10T10:00:00Z");
    expect(requestError({ kickoffAt, eventCancelled: false, zones: [], now })).toMatch(/au moins une zone/);
    expect(requestError({ kickoffAt, eventCancelled: false, zones: ["VIP"], now })).toMatch(/inconnue/);
    expect(requestError({ kickoffAt, eventCancelled: true, zones: ["PRESS_BOX"], now })).toMatch(/annulé/);
  });

  it("quotas par zone (EF-MED-05)", () => {
    expect(quotaError(["PITCHSIDE"], { PITCHSIDE: 7 }, { PITCHSIDE: 8 })).toBeNull();
    expect(quotaError(["PRESS_BOX", "PITCHSIDE"], { PITCHSIDE: 8 }, { PITCHSIDE: 8 })).toMatch(/Bord terrain/);
    expect(quotaError(["MIXED_ZONE"], { MIXED_ZONE: 500 }, {})).toBeNull();
    expect(formatAccreditationNumber(7)).toBe("ACC-00007");
  });
});

describe("validité d'un badge au scan (RG-16)", () => {
  const kickoffAt = new Date("2026-11-17T19:00:00Z");
  const base = { status: "APPROVED" as const, kickoffAt, eventCancelled: false };
  it("valable avant et pendant le match", () => {
    expect(badgeValidity({ ...base, now: new Date("2026-11-17T10:00:00Z") }).ok).toBe(true);
    expect(badgeValidity({ ...base, now: new Date("2026-11-17T22:30:00Z") }).ok).toBe(true);
  });
  it("refusé une fois le match terminé, annulé, ou sans approbation", () => {
    expect(badgeValidity({ ...base, now: new Date("2026-11-18T00:00:00Z") })).toEqual({ ok: false, reason: expect.stringContaining("terminé") });
    expect(badgeValidity({ ...base, eventCancelled: true, now: kickoffAt }).ok).toBe(false);
    expect(badgeValidity({ ...base, status: "PENDING", now: kickoffAt }).reason).toContain("pas encore validée");
    expect(badgeValidity({ ...base, status: "REFUSED", now: kickoffAt }).reason).toContain("refusée");
  });
  it("adresse de la photo seulement si le badge en a une", () => {
    expect(pressPhotoUrl({ badgeToken: "abc", photoKey: null })).toBeNull();
    expect(pressPhotoUrl({ badgeToken: "abc", photoKey: "accreditations/1/0123456789ab-cdef.png" })).toMatch(/^\/accreditations\/photo\/abc\?v=/);
  });
});

describe("justificatif de la qualité de journaliste", () => {
  it("avec une carte de presse : le numéro suffit (scan facultatif)", () => {
    expect(pressProofError({ hasCard: true, cardNumber: "CP-2026-114", hasFile: false })).toBeNull();
    expect(pressProofError({ hasCard: true, cardNumber: " ", hasFile: true })?.field).toBe("pressCardNumber");
  });
  it("sans carte (pigiste, stagiaire) : l'ordre de mission du média est exigé", () => {
    expect(pressProofError({ hasCard: false, cardNumber: "", hasFile: true })).toBeNull();
    expect(pressProofError({ hasCard: false, cardNumber: "", hasFile: false })?.field).toBe("proof");
  });
  it("affiche la carte, ou l'ordre de mission à défaut", () => {
    expect(pressCredential({ pressCardNumber: "CP-1" })).toBe("Carte de presse CP-1");
    expect(pressCredential({ pressCardNumber: null })).toBe("Ordre de mission du média");
  });
});
