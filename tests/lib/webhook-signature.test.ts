import { describe, expect, it } from "vitest";
import { sign, verifySignature } from "@/lib/webhook-signature";

describe("Signature des rappels de paiement", () => {
  const body = JSON.stringify({ reference: "BIL-ab12cd34", status: "SUCCEEDED" });

  it("accepte une signature valide", () => {
    expect(verifySignature(body, sign(body, "secret-partage"), "secret-partage")).toBe(true);
  });

  it("refuse un corps modifié, un autre secret, une signature absente ou un secret non configuré", () => {
    const header = sign(body, "secret-partage");
    expect(verifySignature(body.replace("SUCCEEDED", "FAILED"), header, "secret-partage")).toBe(false);
    expect(verifySignature(body, header, "autre-secret")).toBe(false);
    expect(verifySignature(body, null, "secret-partage")).toBe(false);
    expect(verifySignature(body, header, undefined)).toBe(false);
    expect(verifySignature(body, header, "")).toBe(false);
  });
});
