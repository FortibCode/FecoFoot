import { describe, expect, it } from "vitest";
import { decideExternalUpdate, mapExternalStatus, normalizeClubName, roundFromLabel, type MatchState } from "@/lib/external-sync-rules";

describe("Synchronisation avec une source externe", () => {
  const base: MatchState = { status: "SCHEDULED", homeScore: null, awayScore: null, validatedAt: null, scoreSource: "OFFICIAL", officialEntry: false };

  it("statuts du fournisseur : en cours, mi-temps, terminé, reporté, inconnu", () => {
    expect(mapExternalStatus("1H")).toBe("LIVE");
    expect(mapExternalStatus("HT")).toBe("HALF_TIME");
    expect(mapExternalStatus("FT")).toBe("FINISHED");
    expect(mapExternalStatus("PEN")).toBe("FINISHED");
    expect(mapExternalStatus("PST")).toBe("POSTPONED");
    expect(mapExternalStatus("NS")).toBe("SCHEDULED");
    expect(mapExternalStatus("???")).toBeNull();
  });

  it("journée d'après l'intitulé du tour", () => {
    expect(roundFromLabel("Regular Season - 7")).toBe(7);
    expect(roundFromLabel("Final")).toBe(1);
    expect(roundFromLabel(null)).toBe(1);
  });

  it("applique le score externe d'un match sans saisie officielle", () => {
    expect(decideExternalUpdate(base, { status: "LIVE", homeScore: 1, awayScore: 0 })).toEqual({ action: "apply" });
    expect(decideExternalUpdate({ ...base, status: "LIVE", homeScore: 1, awayScore: 0, scoreSource: "EXTERNAL" }, { status: "LIVE", homeScore: 1, awayScore: 0 })).toEqual({ action: "skip" });
  });

  it("n'écrase jamais un résultat validé ni une feuille de match officielle : conflit à examiner", () => {
    const validated = { ...base, status: "FINISHED" as const, homeScore: 2, awayScore: 1, validatedAt: new Date() };
    expect(decideExternalUpdate(validated, { status: "FINISHED", homeScore: 2, awayScore: 2 }).action).toBe("conflict");
    expect(decideExternalUpdate(validated, { status: "FINISHED", homeScore: 2, awayScore: 1 }).action).toBe("skip");
    const official = { ...base, status: "LIVE" as const, homeScore: 1, awayScore: 0, officialEntry: true };
    expect(decideExternalUpdate(official, { status: "LIVE", homeScore: 1, awayScore: 1 }).action).toBe("conflict");
  });

  it("noms de clubs comparables malgré accents, casse et sigles", () => {
    expect(normalizeClubName("AS Otohô")).toBe(normalizeClubName("Otoho"));
    expect(normalizeClubName("CARA Brazzaville")).toBe("cara brazzaville");
    expect(normalizeClubName("Étoile du Congo")).toBe(normalizeClubName("Etoile Congo"));
  });
});
