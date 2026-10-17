import { describe, expect, it } from "vitest";
import { formatAccreditationNumber, quotaError, requestDeadline, requestError } from "@/lib/accreditations";

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
