import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { offlineVerdict, tokenHash, type OfflineTicket } from "@/lib/offline-control";

describe("Contrôle d'accès hors ligne (EF-CTL-06)", () => {
  it("empreinte identique à celle calculée par le serveur", async () => {
    const token = "abcDEF123_-abcDEF123_-xyz";
    expect(await tokenHash(token)).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("décision locale", () => {
    const t: OfflineTicket = { h: "h1", number: "TKT-1", holder: "A", category: "C", gate: "Porte A", status: "VALID", banned: false };
    expect(offlineVerdict(undefined, new Set())).toBe("UNKNOWN");
    expect(offlineVerdict(t, new Set())).toBeNull();
    expect(offlineVerdict(t, new Set(["h1"]))).toBe("ALREADY_USED");
    expect(offlineVerdict({ ...t, status: "USED" }, new Set())).toBe("ALREADY_USED");
    expect(offlineVerdict({ ...t, banned: true }, new Set())).toBe("BANNED");
    // Badge presse : entrées multiples (EF-CTL-04).
    expect(offlineVerdict({ ...t, badge: true }, new Set(["h1"]))).toBeNull();
  });
});
