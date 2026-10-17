import { describe, expect, it } from "vitest";
import { ageOnSeasonStart, formatCongoPhone, formatFanId, normalizeCongoPhone, operatorOf, tierError } from "@/lib/supporters";

describe("Téléphone Mobile Money (EF-SUP-01)", () => {
  it("normalise les écritures courantes au format +242", () => {
    for (const input of ["06 123 45 67", "061234567", "+242 06 123 45 67", "00242061234567", "242-06-123-45-67", "(06) 123.45.67"]) {
      expect(normalizeCongoPhone(input)).toBe("+242061234567");
    }
  });

  it("refuse les numéros invalides", () => {
    for (const input of ["", "12345", "07 123 45 67", "+33 6 12 34 56 78", "06 123 45 6"]) expect(normalizeCongoPhone(input)).toBeNull();
  });

  it("opérateur déduit du préfixe", () => {
    expect(operatorOf("+242051234567")).toBe("AIRTEL");
    expect(operatorOf("+242061234567")).toBe("MTN");
    expect(operatorOf("+242041234567")).toBeNull();
    expect(formatCongoPhone("+242061234567")).toBe("+242 06 123 45 67");
  });

  it("numéro de Fan ID", () => {
    expect(formatFanId(1)).toBe("FAN-000001");
  });
});

describe("Club des supporters (EF-SUP-03)", () => {
  it("âge au 1er juillet de la saison", () => {
    expect(ageOnSeasonStart(new Date("2009-07-01T00:00:00Z"), 2026)).toBe(17);
    expect(ageOnSeasonStart(new Date("2008-06-30T00:00:00Z"), 2026)).toBe(18);
  });

  it("formule jeune réservée aux moins de 18 ans", () => {
    expect(tierError("YOUTH", new Date("2010-01-01T00:00:00Z"), 2026)).toBeNull();
    expect(tierError("YOUTH", new Date("2000-01-01T00:00:00Z"), 2026)).toMatch(/jeune/);
    expect(tierError("ADULT", new Date("2010-01-01T00:00:00Z"), 2026)).toBeNull();
  });
});
