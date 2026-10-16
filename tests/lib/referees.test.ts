import { describe, expect, it } from "vitest";
import { calledPlayerError, shirtNumberError } from "@/lib/national-teams";
import { designationError, matchDay, type Designation } from "@/lib/referees";

describe("Désignations des officiels (EF-ARB-03, RG-08)", () => {
  const existing: Designation[] = [
    { matchId: 1, refereeId: 10, role: "REFEREE", day: "2026-10-03" },
    { matchId: 1, refereeId: 11, role: "ASSISTANT_1", day: "2026-10-03" },
  ];

  it("jour du match à l'heure de Brazzaville", () => {
    expect(matchDay(new Date("2026-10-03T23:30:00Z"))).toBe("2026-10-04");
    expect(matchDay(new Date("2026-10-03T15:30:00Z"))).toBe("2026-10-03");
  });

  it("pas deux fonctions pour un même officiel sur un match", () => {
    expect(designationError({ matchId: 1, refereeId: 10, role: "ASSISTANT_2", day: "2026-10-03" }, existing)).toMatch(/autre fonction/);
  });

  it("pas deux matchs le même jour", () => {
    expect(designationError({ matchId: 2, refereeId: 10, role: "REFEREE", day: "2026-10-03" }, existing)).toMatch(/même jour/);
    expect(designationError({ matchId: 2, refereeId: 10, role: "REFEREE", day: "2026-10-04" }, existing)).toBeNull();
  });

  it("remplacer l'officiel d'une fonction est permis", () => {
    expect(designationError({ matchId: 1, refereeId: 12, role: "REFEREE", day: "2026-10-03" }, existing)).toBeNull();
    // Le même officiel reconduit dans sa fonction.
    expect(designationError({ matchId: 1, refereeId: 10, role: "REFEREE", day: "2026-10-03" }, existing)).toBeNull();
  });
});

describe("Convocations (EF-SEL-02)", () => {
  it("joueur du registre ou joueur de l'étranger (club et pays)", () => {
    expect(calledPlayerError({ playerId: 5, externalName: null, externalClub: null, externalCountry: null })).toBeNull();
    expect(calledPlayerError({ playerId: null, externalName: "Thievy Bifouma", externalClub: "RC Lens", externalCountry: "France" })).toBeNull();
    expect(calledPlayerError({ playerId: null, externalName: "X Y", externalClub: null, externalCountry: "France" })).toMatch(/Club et pays/);
    expect(calledPlayerError({ playerId: 5, externalName: "X Y", externalClub: "A", externalCountry: "B" })).toMatch(/pas les deux/);
  });

  it("numéros de maillot uniques de 1 à 99", () => {
    expect(shirtNumberError(10, [1, 9])).toBeNull();
    expect(shirtNumberError(9, [1, 9])).toMatch(/déjà/);
    expect(shirtNumberError(100, [])).toMatch(/1 et 99/);
  });
});
