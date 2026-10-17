import { describe, expect, it } from "vitest";
import { can, canAccessClub, ROLES, scopeError, type Permission, type Role } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";

describe("Matrice des droits (§3.3)", () => {
  const cases: [Permission, Role[]][] = [
    ["users.manage", ["SUPER_ADMIN"]],
    ["audit.read", ["SUPER_ADMIN", "FEDERATION_ADMIN"]],
    ["leagues.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN"]],
    ["licenses.validate", ["SUPER_ADMIN", "FEDERATION_ADMIN", "LEAGUE"]],
    ["licenses.request", ["CLUB"]],
    ["transfers.approve", ["SUPER_ADMIN", "FEDERATION_ADMIN"]],
    ["transfers.review", ["SUPER_ADMIN", "FEDERATION_ADMIN", "LEAGUE"]],
    ["national_teams.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN", "DTN"]],
    ["communication.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN", "COMMUNICATION"]],
    ["ticketing.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN", "TICKETING"]],
    ["refereeing.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN", "REFEREEING"]],
    ["players.read", ["SUPER_ADMIN", "FEDERATION_ADMIN", "LEAGUE", "CLUB", "DTN"]],
    ["discipline.manage", ["SUPER_ADMIN", "FEDERATION_ADMIN", "DISCIPLINE"]],
  ];

  it.each(cases)("%s est réservé à %j", (permission, allowed) => {
    for (const role of ROLES) expect(can(role, permission)).toBe(allowed.includes(role));
  });

  it("tous les profils voient le tableau de bord", () => {
    for (const role of ROLES) expect(can(role, "dashboard.view")).toBe(true);
  });

  it("le menu d'un club ne propose ni ligues, ni utilisateurs, ni billetterie", () => {
    const labels = modulesFor("CLUB").map((m) => m.label);
    expect(labels).toContain("Licences");
    expect(labels).not.toContain("Ligues");
    expect(labels).not.toContain("Utilisateurs");
    expect(labels).not.toContain("Billetterie");
  });
});

describe("Périmètre de données (EF-CLB-04)", () => {
  const club = { id: 7, leagueId: 1 };

  it("une ligue ne voit que les clubs de son territoire", () => {
    expect(canAccessClub({ role: "LEAGUE", leagueId: 1, clubId: null }, club)).toBe(true);
    expect(canAccessClub({ role: "LEAGUE", leagueId: 2, clubId: null }, club)).toBe(false);
  });

  it("un club ne voit que sa propre fiche", () => {
    expect(canAccessClub({ role: "CLUB", leagueId: null, clubId: 7 }, club)).toBe(true);
    expect(canAccessClub({ role: "CLUB", leagueId: null, clubId: 8 }, club)).toBe(false);
  });

  it("la fédération voit tous les clubs, la billetterie aucun", () => {
    expect(canAccessClub({ role: "FEDERATION_ADMIN", leagueId: null, clubId: null }, club)).toBe(true);
    expect(canAccessClub({ role: "TICKETING", leagueId: null, clubId: null }, club)).toBe(false);
  });

  it("refuse un compte dont le rattachement ne correspond pas au profil", () => {
    expect(scopeError({ role: "LEAGUE", leagueId: null, clubId: null })).not.toBeNull();
    expect(scopeError({ role: "CLUB", leagueId: null, clubId: null })).not.toBeNull();
    expect(scopeError({ role: "DTN", leagueId: 1, clubId: null })).not.toBeNull();
    expect(scopeError({ role: "CLUB", leagueId: null, clubId: 3 })).toBeNull();
  });
});
