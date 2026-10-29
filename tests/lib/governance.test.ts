import { describe, expect, it } from "vitest";
import { positionRank, sortMembers } from "@/lib/governance";

describe("instances : ordre des fonctions", () => {
  it("classe président, vice-président(s), secrétaire, trésorier puis membres", () => {
    expect(positionRank("Président")).toBe(0);
    expect(positionRank("1er Vice-président")).toBe(1);
    expect(positionRank("Vice-Présidente")).toBe(1);
    expect(positionRank("Secrétaire général")).toBe(2);
    expect(positionRank("Trésorier")).toBe(3);
    expect(positionRank("Membre")).toBe(9);
  });
  it("trie les membres par fonction puis par nom", () => {
    const sorted = sortMembers([
      { fullName: "YENGO Omerine Destinée", position: "Membre" },
      { fullName: "BANTABA Sabhas Ghislain", position: "Vice-président" },
      { fullName: "MOUKOKO Jean Michel", position: "Membre" },
      { fullName: "KIBELO Jean Baptiste Marcel", position: "Président" },
    ]);
    expect(sorted.map((m) => m.fullName)).toEqual(["KIBELO Jean Baptiste Marcel", "BANTABA Sabhas Ghislain", "MOUKOKO Jean Michel", "YENGO Omerine Destinée"]);
  });
});
