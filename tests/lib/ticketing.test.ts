import { describe, expect, it } from "vitest";
import { capError, formatTicketNumber, gateKey, gateLoad, purchaseError, remaining, scanRefusal, ticketTokenFrom, unitPrice } from "@/lib/ticketing";

const kickoffAt = new Date("2026-10-18T15:00:00Z");
const now = new Date("2026-10-10T10:00:00Z");

describe("Vente en ligne (EF-BIL-03, EF-BIL-04, RG-12, RG-14)", () => {
  it("prévente réservée aux membres", () => {
    expect(purchaseError({ status: "PRESALE", isMember: true, banned: false, kickoffAt, now })).toBeNull();
    expect(purchaseError({ status: "PRESALE", isMember: false, banned: false, kickoffAt, now })).toMatch(/membres/);
  });

  it("vente ouverte à tous ; brouillon, clôture ou annulation : pas de vente", () => {
    expect(purchaseError({ status: "OPEN", isMember: false, banned: false, kickoffAt, now })).toBeNull();
    for (const status of ["DRAFT", "CLOSED", "CANCELLED"] as const) {
      expect(purchaseError({ status, isMember: true, banned: false, kickoffAt, now })).toMatch(/pas ouverte/);
    }
  });

  it("interdiction de stade et match commencé", () => {
    expect(purchaseError({ status: "OPEN", isMember: true, banned: true, kickoffAt, now })).toMatch(/interdiction/);
    expect(purchaseError({ status: "OPEN", isMember: true, banned: false, kickoffAt, now: kickoffAt })).toMatch(/commencé/);
  });

  it("tarif membre pour les adhérents", () => {
    const cat = { publicPrice: 10000, memberPrice: 7500 };
    expect(unitPrice(cat, true)).toBe(7500);
    expect(unitPrice(cat, false)).toBe(10000);
    // Un tarif membre mal saisi (plus cher) ne pénalise jamais le membre.
    expect(unitPrice({ publicPrice: 5000, memberPrice: 6000 }, true)).toBe(5000);
  });
});

describe("Plafond par Fan ID (RG-10) et jauge", () => {
  it("4 billets par défaut", () => {
    expect(capError(0, 4, 4)).toBeNull();
    expect(capError(2, 3, 4)).toMatch(/encore en prendre 2/);
    expect(capError(4, 1, 4)).toMatch(/déjà atteint/);
    expect(capError(0, 0, 4)).toMatch(/au moins un/);
  });

  it("places restantes jamais négatives", () => {
    expect(remaining(100, 30)).toBe(70);
    expect(remaining(100, 120)).toBe(0);
    expect(formatTicketNumber(42)).toBe("TKT-0000042");
  });
});

describe("Contrôle d'accès (EF-CTL-02, EF-CTL-03)", () => {
  const valid = { eventId: 1, status: "VALID" as const, holderBanned: false };
  it("motifs de refus", () => {
    expect(scanRefusal(null, 1)).toBe("UNKNOWN");
    expect(scanRefusal(valid, 2)).toBe("OTHER_EVENT");
    expect(scanRefusal({ ...valid, status: "CANCELLED" }, 1)).toBe("CANCELLED");
    expect(scanRefusal({ ...valid, status: "RESERVED" }, 1)).toBe("NOT_PAID");
    expect(scanRefusal({ ...valid, status: "USED" }, 1)).toBe("ALREADY_USED");
    expect(scanRefusal({ ...valid, holderBanned: true }, 1)).toBe("BANNED");
    expect(scanRefusal(valid, 1)).toBeNull();
  });

  it("lecture du QR code : URL du billet ou jeton seul", () => {
    const token = "abcDEF123_-abcDEF123_-xyz";
    expect(ticketTokenFrom(`https://billetterie.fecofoot.cg/billet/${token}`)).toBe(token);
    expect(ticketTokenFrom(`  ${token}\n`)).toBe(token);
    expect(ticketTokenFrom(`https://fecofoot.cg/accreditations/badge/${token}`)).toBe(token);
    expect(ticketTokenFrom("n'importe quoi")).toBeNull();
  });
});

describe("Comptage par porte et saturation (EF-CTL-07)", () => {
  it("porte fluide : débit et remplissage sous 80 %", () => {
    const g = gateLoad({ entries: 100, recentEntries: 50, capacity: 1000, flowLimit: 30 });
    expect(g.perMinute).toBe(10);
    expect(g.level).toBe("OK");
    expect(g.reasons).toEqual([]);
  });

  it("vigilance à 80 % du débit maximal, saturation au-delà", () => {
    expect(gateLoad({ entries: 0, recentEntries: 120, capacity: 1000, flowLimit: 30 }).level).toBe("WARN");
    const sat = gateLoad({ entries: 0, recentEntries: 150, capacity: 1000, flowLimit: 30 });
    expect(sat.level).toBe("SATURATED");
    expect(sat.reasons[0]).toMatch(/30 entrées\/min \(max\. 30\)/);
  });

  it("le remplissage de la porte déclenche aussi l'alerte ; le niveau le plus élevé l'emporte", () => {
    expect(gateLoad({ entries: 85, recentEntries: 0, capacity: 100, flowLimit: 30 }).level).toBe("WARN");
    const full = gateLoad({ entries: 100, recentEntries: 125, capacity: 100, flowLimit: 30 });
    expect(full.level).toBe("SATURATED");
    expect(full.reasons).toHaveLength(2);
  });

  it("porte sans tribune rattachée (saisie libre au poste) : seul le débit compte", () => {
    expect(gateLoad({ entries: 40, recentEntries: 5, capacity: 0, flowLimit: 30 }).level).toBe("OK");
  });

  it("noms de porte comparés sans casse ni espaces superflus", () => {
    expect(gateKey("  Porte   A ")).toBe(gateKey("porte a"));
  });
});
