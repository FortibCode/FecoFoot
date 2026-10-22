import { describe, expect, it } from "vitest";
import {
  ageAt,
  categoryError,
  consentLinkExpiry,
  consentValidUntil,
  effectiveStatus,
  formatFederalId,
  formatLicenseNumber,
  identityKey,
  isConsentValid,
  isMinor,
  naturalCategory,
  seasonExpiry,
  seasonLabel,
  seasonOf,
  transition,
  cardStatus,
  cardIssued,
  resubmitStatus,
} from "@/lib/licenses";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("Saison sportive (RG-03)", () => {
  it("commence le 1er juillet, heure de Brazzaville", () => {
    expect(seasonOf(new Date("2026-06-30T12:00:00Z"))).toBe(2025);
    expect(seasonOf(new Date("2026-07-01T00:30:00+01:00"))).toBe(2026);
    // 30 juin 23h30 UTC = 1er juillet 00h30 à Brazzaville
    expect(seasonOf(new Date("2026-06-30T23:30:00Z"))).toBe(2026);
    expect(seasonLabel(2026)).toBe("2026-2027");
  });

  it("une licence expire le 30 juin à 23h59 (Brazzaville)", () => {
    expect(seasonExpiry(2026).toISOString()).toBe("2027-06-30T22:59:59.000Z");
  });
});

describe("Catégories d'âge (RG-04, EF-LIC-04)", () => {
  it("calculées sur l'année de début de saison", () => {
    expect(naturalCategory(d("2014-12-31"), 2026)).toBe("U13"); // 12 ans
    expect(naturalCategory(d("2013-01-01"), 2026)).toBe("U15"); // 13 ans
    expect(naturalCategory(d("2010-05-01"), 2026)).toBe("U17"); // 16 ans
    expect(naturalCategory(d("2007-05-01"), 2026)).toBe("U20"); // 19 ans
    expect(naturalCategory(d("2006-05-01"), 2026)).toBe("SENIOR"); // 20 ans
    expect(naturalCategory(d("1991-05-01"), 2026)).toBe("VETERAN"); // 35 ans
  });

  it("surclassement d'une catégorie autorisé", () => {
    expect(categoryError(d("2010-05-01"), 2026, "U17")).toBeNull();
    expect(categoryError(d("2010-05-01"), 2026, "U20")).toBeNull();
  });

  it("surclassement de plus d'une catégorie refusé", () => {
    expect(categoryError(d("2010-05-01"), 2026, "SENIOR")).toMatch(/Surclassement/);
  });

  it("sous-classement refusé", () => {
    expect(categoryError(d("2007-05-01"), 2026, "U17")).toMatch(/Sous-classement/);
    expect(categoryError(d("2000-05-01"), 2026, "U20")).toMatch(/Sous-classement/);
  });

  it("vétéran : senior autorisé, vétéran réservé aux 35 ans et plus", () => {
    expect(categoryError(d("1985-05-01"), 2026, "SENIOR")).toBeNull();
    expect(categoryError(d("1985-05-01"), 2026, "VETERAN")).toBeNull();
    expect(categoryError(d("1995-05-01"), 2026, "VETERAN")).toMatch(/35 ans/);
  });
});

describe("Identifiants (RG-01, EF-LIC-01, EF-LIC-02)", () => {
  it("formats FCF-J-AAAA-000001 et LIC-AAAA-000001", () => {
    expect(formatFederalId(2026, 1)).toBe("FCF-J-2026-000001");
    expect(formatLicenseNumber(2026, 42)).toBe("LIC-2026-000042");
  });

  it("clé anti-doublon insensible aux accents, à la casse et aux espaces", () => {
    expect(identityKey("Nkounkou", "Gloire", "2004-06-20")).toBe(identityKey(" NKOUNKOU ", "gloire", "2004-06-20"));
    expect(identityKey("Ékoundzola", "Jean-Marc", "2004-06-20")).toBe(identityKey("EKOUNDZOLA", "Jean Marc", "2004-06-20"));
    expect(identityKey("Nkounkou", "Gloire", "2004-06-20")).not.toBe(identityKey("Nkounkou", "Gloire", "2004-06-21"));
  });

  it("minorité calculée au jour près", () => {
    expect(ageAt(d("2008-09-30"), d("2026-09-29"))).toBe(17);
    expect(isMinor(d("2008-09-30"), d("2026-09-29"))).toBe(true);
    expect(isMinor(d("2008-09-29"), d("2026-09-29"))).toBe(false);
  });
});

describe("Cycle de vie de la licence (EF-LIC-05, RG-05)", () => {
  const ok = { hasValidConsent: true, expired: false };

  it("en attente → droits encaissés → validée → suspendue → réactivée", () => {
    expect(transition("PENDING", "pay", ok)).toEqual({ to: "PAID" });
    expect(transition("PAID", "validate", ok)).toEqual({ to: "VALIDATED" });
    expect(transition("VALIDATED", "suspend", ok)).toEqual({ to: "SUSPENDED" });
    expect(transition("SUSPENDED", "reactivate", ok)).toEqual({ to: "VALIDATED" });
  });

  it("validation impossible sans droits payés", () => {
    expect(transition("PENDING", "validate", ok)).toHaveProperty("error");
  });

  it("validation impossible sans accord en ligne", () => {
    expect(transition("PAID", "validate", { hasValidConsent: false, expired: false })).toEqual({
      error: expect.stringMatching(/accord/),
    });
  });

  it("validation : justificatifs obligatoires puis identité contrôlée", () => {
    expect(transition("PAID", "validate", { ...ok, missingDocuments: ["Acte de naissance"] })).toEqual({ error: expect.stringMatching(/Acte de naissance/) });
    expect(transition("PAID", "validate", { ...ok, missingDocuments: [], identityVerified: false })).toEqual({ error: expect.stringMatching(/identité/) });
    expect(transition("PAID", "validate", { ...ok, missingDocuments: [], identityVerified: true })).toEqual({ to: "VALIDATED" });
  });

  it("corrections demandées puis nouvelle soumission au même stade", () => {
    expect(transition("PAID", "correct", ok)).toEqual({ to: "TO_CORRECT" });
    expect(transition("TO_CORRECT", "validate", ok)).toHaveProperty("error");
    expect(transition("VALIDATED", "correct", ok)).toHaveProperty("error");
    expect(resubmitStatus(true)).toBe("PAID");
    expect(resubmitStatus(false)).toBe("PENDING");
  });

  it("révocation définitive d'une licence délivrée", () => {
    expect(transition("VALIDATED", "revoke", ok)).toEqual({ to: "REVOKED" });
    expect(transition("SUSPENDED", "revoke", ok)).toEqual({ to: "REVOKED" });
    for (const a of ["reactivate", "validate", "suspend"] as const) expect(transition("REVOKED", a, ok)).toHaveProperty("error");
    expect(transition("PENDING", "revoke", ok)).toHaveProperty("error");
  });

  it("statut de la carte : active, en attente, expirée, suspendue, révoquée", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    expect(cardStatus("VALIDATED", future)).toBe("ACTIVE");
    expect(cardStatus("VALIDATED", past)).toBe("EXPIRED");
    expect(cardStatus("TO_CORRECT", future)).toBe("PENDING");
    expect(cardStatus("SUSPENDED", future)).toBe("SUSPENDED");
    expect(cardStatus("REVOKED", future)).toBe("REVOKED");
    expect(cardIssued("PAID")).toBe(false);
    expect(cardIssued("REVOKED")).toBe(true);
  });

  it("rejet possible avant validation uniquement", () => {
    expect(transition("PAID", "reject", ok)).toEqual({ to: "REJECTED" });
    expect(transition("VALIDATED", "reject", ok)).toHaveProperty("error");
  });

  it("aucune action sur une licence expirée", () => {
    expect(transition("VALIDATED", "suspend", { hasValidConsent: true, expired: true })).toHaveProperty("error");
  });

  it("une licence validée devient expirée après le 30 juin", () => {
    const exp = seasonExpiry(2025);
    expect(effectiveStatus("VALIDATED", exp, new Date("2026-06-30T12:00:00Z"))).toBe("VALIDATED");
    expect(effectiveStatus("VALIDATED", exp, new Date("2026-07-01T00:00:00Z"))).toBe("EXPIRED");
    expect(effectiveStatus("PENDING", exp, new Date("2026-07-01T00:00:00Z"))).toBe("PENDING");
  });
});

describe("Accord en ligne (M05)", () => {
  it("lien valable 14 jours, accord valable 5 ans", () => {
    expect(consentLinkExpiry(d("2026-09-01")).toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(consentValidUntil(d("2026-09-01")).toISOString()).toBe("2031-09-01T00:00:00.000Z");
  });

  it("n'est valable que pour le club qui l'a demandé et pendant 5 ans", () => {
    const consent = { status: "ACCEPTED" as const, clubId: 3, validUntil: d("2031-09-01") };
    expect(isConsentValid(consent, 3, d("2026-10-01"))).toBe(true);
    expect(isConsentValid(consent, 4, d("2026-10-01"))).toBe(false);
    expect(isConsentValid(consent, 3, d("2031-09-02"))).toBe(false);
    expect(isConsentValid({ ...consent, status: "REFUSED" }, 3, d("2026-10-01"))).toBe(false);
    expect(isConsentValid(undefined, 3)).toBe(false);
  });
});
