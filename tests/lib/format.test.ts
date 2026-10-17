import { describe, expect, it } from "vitest";
import { passwordPolicyError } from "@/lib/auth/password";
import { formatAffiliationNumber } from "@/lib/clubs";
import { formatDateTime, formatFcfa, slugify } from "@/lib/format";

describe("Numéro d'affiliation (EF-CLB-02)", () => {
  it("suit le format FCF-CLB-0001", () => {
    expect(formatAffiliationNumber(1)).toBe("FCF-CLB-0001");
    expect(formatAffiliationNumber(123)).toBe("FCF-CLB-0123");
    expect(formatAffiliationNumber(12345)).toBe("FCF-CLB-12345");
  });
  it("refuse une valeur de séquence invalide", () => {
    expect(() => formatAffiliationNumber(0)).toThrow();
  });
});

describe("Formats d'affichage (§7.4, RG-17)", () => {
  it("montants en FCFA sans décimale", () => {
    expect(formatFcfa(25000).replace(/\s/g, " ")).toBe("25 000 FCFA");
    expect(formatFcfa(1999.6).replace(/\s/g, " ")).toBe("2 000 FCFA");
  });
  it("heure de Brazzaville (UTC+1)", () => {
    expect(formatDateTime(new Date("2026-10-18T15:00:00Z"))).toBe("18/10/2026 16:00");
  });
  it("identifiants d'URL sans accents", () => {
    expect(slugify("Étoile du Congo")).toBe("etoile-du-congo");
    expect(slugify("  CARA — Brazzaville ")).toBe("cara-brazzaville");
  });
});

describe("Politique de mot de passe", () => {
  it("exige 12 caractères avec lettres et chiffres", () => {
    expect(passwordPolicyError("court1")).not.toBeNull();
    expect(passwordPolicyError("seulementdeslettres")).not.toBeNull();
    expect(passwordPolicyError("Fecofoot2026Brazza")).toBeNull();
  });
});

describe("Champs facultatifs de formulaire", () => {
  it("absent (champ masqué) ou vide → null", async () => {
    const { blankToNull } = await import("@/lib/action-state");
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull("   ")).toBeNull();
    expect(blankToNull("2027-06-30")).toBe("2027-06-30");
  });
});

describe("Drapeaux des adversaires", () => {
  it("retrouve le drapeau sans tenir compte des accents ni de la casse", async () => {
    const { flagUrl } = await import("@/lib/flags");
    expect(flagUrl("Namibie")).toBe("/flags/na.svg");
    expect(flagUrl(" CAMEROUN ")).toBe("/flags/cm.svg");
    expect(flagUrl("Atlantide")).toBeNull();
  });
});
