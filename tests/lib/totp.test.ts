import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, otpauthUri, totp, totpStep, twoFactorRequired, verifyTotp } from "@/lib/auth/totp";

// Vecteurs de test officiels : RFC 4226 (annexe D) et RFC 6238 (annexe B), secret « 12345678901234567890 ».
const RFC_SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("Double authentification TOTP (EF-AUT-05)", () => {
  it("base32 aller-retour", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(new TextDecoder().decode(base32Decode(RFC_SECRET))).toBe("12345678901234567890");
  });

  it("HOTP conforme à la RFC 4226", () => {
    expect([0, 1, 2, 9].map((c) => hotp(RFC_SECRET, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("TOTP conforme à la RFC 6238 (6 chiffres)", () => {
    expect(totp(RFC_SECRET, new Date(59_000))).toBe("287082");
    expect(totp(RFC_SECRET, new Date(1111111109_000))).toBe("081804");
    expect(totp(RFC_SECRET, new Date(1234567890_000))).toBe("005924");
  });

  it("tolère ±30 s de décalage d'horloge, pas davantage", () => {
    const at = new Date("2026-09-29T10:00:00Z");
    const code = totp(RFC_SECRET, at);
    expect(verifyTotp(RFC_SECRET, code, { at: new Date(at.getTime() + 30_000) })).toBe(totpStep(at));
    expect(verifyTotp(RFC_SECRET, code, { at: new Date(at.getTime() + 90_000) })).toBeNull();
  });

  it("refuse le rejeu d'un code déjà utilisé", () => {
    const at = new Date("2026-09-29T10:00:00Z");
    const code = totp(RFC_SECRET, at);
    const step = verifyTotp(RFC_SECRET, code, { at })!;
    expect(verifyTotp(RFC_SECRET, code, { at, lastStep: step })).toBeNull();
  });

  it("refuse un code mal formé", () => {
    expect(verifyTotp(RFC_SECRET, "12a456")).toBeNull();
    expect(verifyTotp(RFC_SECRET, "")).toBeNull();
  });

  it("obligatoire pour les profils fédéraux et la billetterie par défaut", () => {
    expect(twoFactorRequired("SUPER_ADMIN", undefined)).toBe(true);
    expect(twoFactorRequired("TICKETING", undefined)).toBe(true);
    expect(twoFactorRequired("CLUB", undefined)).toBe(false);
    expect(twoFactorRequired("SUPER_ADMIN", "")).toBe(false);
  });

  it("lien à scanner pour l'application", () => {
    expect(otpauthUri("ABC", "admin@fecofoot.cg")).toBe(
      "otpauth://totp/FECOFOOT%3Aadmin%40fecofoot.cg?secret=ABC&issuer=FECOFOOT&algorithm=SHA1&digits=6&period=30",
    );
  });
});
