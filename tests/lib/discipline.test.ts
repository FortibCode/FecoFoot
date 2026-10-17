import { describe, expect, it } from "vitest";
import { autoSuspensions, caseSuspensionActive, decisionError, formatCaseNumber, type CardMatch } from "@/lib/discipline";

const A = 1; // club du joueur
const B = 2;
const d = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T15:00:00Z`);
const match = (id: number, day: number, events: CardMatch["events"] = [], status = "FINISHED"): CardMatch => ({
  id,
  kickoffAt: d(day),
  homeClubId: A,
  awayClubId: B,
  status,
  events,
});
const yellow = (playerId = 10) => ({ playerId, clubId: A, type: "YELLOW_CARD" });
const red = (playerId = 10) => ({ playerId, clubId: A, type: "RED_CARD" });

describe("Suspensions automatiques (EF-DIS-01)", () => {
  it("carton rouge : 1 match, purgé au match suivant du club", () => {
    const s = autoSuspensions([match(1, 1, [red()]), match(2, 8)]);
    expect(s).toEqual([{ playerId: 10, clubId: A, fromMatchId: 1, reason: "RED_CARD", matches: 1, servedInMatchIds: [2], active: false }]);
  });

  it("suspension en cours tant que le club n'a pas rejoué", () => {
    const s = autoSuspensions([match(1, 1, [red()]), match(2, 8, [], "SCHEDULED")]);
    expect(s[0].active).toBe(true);
  });

  it("deux jaunes dans le même match : expulsion, sans compter dans le cumul", () => {
    const s = autoSuspensions([match(1, 1, [yellow(), yellow()]), match(2, 8, [yellow()]), match(3, 15, [yellow()]), match(4, 22)]);
    expect(s).toHaveLength(1);
    expect(s[0].reason).toBe("TWO_YELLOWS");
  });

  it("cumul : un match tous les 3 jaunes sur des matchs différents", () => {
    const matches = [1, 2, 3, 4, 5, 6].map((i) => match(i, i * 7 - 6, [yellow()]));
    const s = autoSuspensions([...matches, match(7, 50)]);
    expect(s.map((x) => x.fromMatchId)).toEqual([3, 6]);
    expect(s.every((x) => x.reason === "YELLOW_ACCUMULATION")).toBe(true);
    expect(s[1].servedInMatchIds).toEqual([7]);
  });

  it("seuil réglable par compétition ; matchs non terminés ignorés", () => {
    expect(autoSuspensions([match(1, 1, [yellow()]), match(2, 8, [yellow()])], 2)).toHaveLength(1);
    expect(autoSuspensions([match(1, 1, [red()], "SCHEDULED")])).toEqual([]);
  });

  it("seuls les matchs du club du joueur purgent la suspension", () => {
    const other: CardMatch = { id: 2, kickoffAt: d(5), homeClubId: 3, awayClubId: 4, status: "FINISHED", events: [] };
    const s = autoSuspensions([match(1, 1, [red()]), other, match(3, 9)]);
    expect(s[0].servedInMatchIds).toEqual([3]);
  });
});

describe("Décisions de la commission (EF-DIS-01)", () => {
  const base = { playerId: null, clubId: null, competitionId: null, suspensionMatches: null, suspensionUntil: null, fineAmount: null, pointsDeducted: null, now: d(1) };

  it("contrôles de cohérence", () => {
    expect(decisionError({ ...base, type: "WARNING" })).toBeNull();
    expect(decisionError({ ...base, type: "MATCH_SUSPENSION" })).toMatch(/joueur/);
    expect(decisionError({ ...base, type: "MATCH_SUSPENSION", playerId: 1 })).toMatch(/Nombre de matchs/);
    expect(decisionError({ ...base, type: "MATCH_SUSPENSION", playerId: 1, suspensionMatches: 2 })).toBeNull();
    expect(decisionError({ ...base, type: "TIME_SUSPENSION", playerId: 1, suspensionUntil: d(1) })).toMatch(/future/);
    expect(decisionError({ ...base, type: "FINE", fineAmount: 50000 })).toBeNull();
    expect(decisionError({ ...base, type: "POINTS_DEDUCTION", clubId: 1, pointsDeducted: 3 })).toMatch(/compétition/);
    expect(decisionError({ ...base, type: "POINTS_DEDUCTION", clubId: 1, competitionId: 2, pointsDeducted: 3 })).toBeNull();
    expect(formatCaseNumber(2026, 3)).toBe("DIS-2026-0003");
  });

  it("suspension prononcée : en matchs ou en durée", () => {
    const m = { type: "MATCH_SUSPENSION" as const, suspensionMatches: 2, suspensionUntil: null };
    expect(caseSuspensionActive(m, 1)).toBe(true);
    expect(caseSuspensionActive(m, 2)).toBe(false);
    const t = { type: "TIME_SUSPENSION" as const, suspensionMatches: null, suspensionUntil: d(20) };
    expect(caseSuspensionActive(t, 5, d(10))).toBe(true);
    expect(caseSuspensionActive(t, 0, d(21))).toBe(false);
  });
});
