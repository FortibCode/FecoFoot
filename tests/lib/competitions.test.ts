import { describe, expect, it } from "vitest";
import {
  buildBracket,
  divisionName,
  competitionFamily,
  formatLabel,
  liveMinute,
  matchHistory,
  publicMatchStatus,
  pitchLines,
  streaks,
  recordTotals,
  groupTable,
  statsError,
  statRows,
  formationError,
  goalBuckets,
  nextPeriod,
  publicStatus,
  publicStatusLabel,
  knockoutWinner,
  lineupError,
  nextSlot,
  roundCount,
  roundLabel,
  roundRobin,
  scoreFromEvents,
  shuffle,
  standings,
  nextSeasonClubs,
  standingZone,
  parseTiebreakers,
  canReschedule,
  hasScore,
  isLive,
  topScorers,
  type Pairing,
} from "@/lib/competitions";

const pairKey = (p: Pairing) => [p.home, p.away].sort((a, b) => a - b).join("-");

describe("Calendrier toutes rondes (EF-CMP-03)", () => {
  for (const n of [4, 6, 10, 5, 7]) {
    it(`${n} équipes : chaque paire se rencontre une fois, une rencontre par équipe et par journée`, () => {
      const teams = Array.from({ length: n }, (_, i) => i + 1);
      const fixtures = roundRobin(teams, { doubleRound: false });
      expect(fixtures).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(fixtures.map(pairKey)).size).toBe(fixtures.length);
      const rounds = n % 2 === 0 ? n - 1 : n;
      for (let r = 1; r <= rounds; r++) {
        const playing = fixtures.filter((f) => f.round === r).flatMap((f) => [f.home, f.away]);
        expect(new Set(playing).size).toBe(playing.length);
      }
    });
  }

  it("aller-retour : chaque paire deux fois, réceptions inversées au retour", () => {
    const fixtures = roundRobin([1, 2, 3, 4, 5, 6], { doubleRound: true });
    expect(fixtures).toHaveLength(30);
    expect(Math.max(...fixtures.map((f) => f.round))).toBe(10);
    for (const f of fixtures.filter((x) => x.round <= 5)) {
      expect(fixtures.some((g) => g.round === f.round + 5 && g.home === f.away && g.away === f.home)).toBe(true);
    }
  });

  it("alternance domicile / extérieur équilibrée", () => {
    const teams = [1, 2, 3, 4, 5, 6, 7, 8];
    const fixtures = roundRobin(teams, { doubleRound: false });
    for (const t of teams) {
      const home = fixtures.filter((f) => f.home === t).length;
      const away = fixtures.filter((f) => f.away === t).length;
      expect(Math.abs(home - away)).toBeLessThanOrEqual(1);
    }
  });

  it("moins de deux équipes : pas de calendrier", () => {
    expect(roundRobin([1], { doubleRound: true })).toEqual([]);
  });
});

describe("Score et classement (RG-07, EF-CMP-06)", () => {
  it("un but contre son camp est crédité à l'adversaire", () => {
    const score = scoreFromEvents(
      [
        { type: "GOAL", clubId: 1, playerId: 10, minute: 5 },
        { type: "PENALTY_GOAL", clubId: 2, playerId: 20, minute: 30 },
        { type: "OWN_GOAL", clubId: 2, playerId: 21, minute: 60 },
        { type: "YELLOW_CARD", clubId: 1, playerId: 11, minute: 70 },
      ],
      1,
      2,
    );
    expect(score).toEqual({ home: 2, away: 1 });
  });

  it("classement : points, puis différence de buts, puis buts marqués", () => {
    const d = (s: string) => new Date(s);
    const table = standings(
      [1, 2, 3, 4],
      [
        { homeClubId: 1, awayClubId: 2, homeScore: 1, awayScore: 0, kickoffAt: d("2026-10-01") },
        { homeClubId: 3, awayClubId: 4, homeScore: 3, awayScore: 2, kickoffAt: d("2026-10-01") },
        { homeClubId: 2, awayClubId: 3, homeScore: 1, awayScore: 1, kickoffAt: d("2026-10-08") },
        { homeClubId: 4, awayClubId: 1, homeScore: 0, awayScore: 0, kickoffAt: d("2026-10-08") },
      ],
      { win: 3, draw: 1, loss: 0 },
    );
    // 1 et 3 : 4 pts, +1 chacun ; 3 a marqué plus (4 contre 1).
    expect(table.map((r) => r.clubId)).toEqual([3, 1, 4, 2]);
    expect(table[0]).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 3, goalDiff: 1, points: 4, form: ["V", "N"] });
  });

  it("départage configurable : confrontation directe avant la différence de buts", () => {
    const m = (h: number, a: number, hs: number, as: number) => ({ homeClubId: h, awayClubId: a, homeScore: hs, awayScore: as, kickoffAt: null });
    const matches = [m(1, 2, 1, 0), m(2, 4, 5, 0), m(3, 1, 1, 0), m(3, 2, 1, 0)];
    const rule = { win: 3, draw: 1, loss: 0 };
    // 1 et 2 : 3 points ; 2 a la meilleure différence (+3 contre 0), mais 1 a gagné leur confrontation.
    expect(standings([1, 2, 3, 4], matches, rule).map((r) => r.clubId)).toEqual([3, 2, 1, 4]);
    expect(standings([1, 2, 3, 4], matches, rule, new Map(), ["H2H_POINTS", "GOAL_DIFF"]).map((r) => r.clubId)).toEqual([3, 1, 2, 4]);
  });

  it("égalité parfaite : ordre stable, et critères inconnus ou en double ignorés", () => {
    const table = standings([5, 2], [{ homeClubId: 5, awayClubId: 2, homeScore: 1, awayScore: 1, kickoffAt: null }], { win: 3, draw: 1, loss: 0 }, new Map(), ["H2H_POINTS", "WINS"]);
    expect(table.map((r) => r.clubId)).toEqual([2, 5]);
    expect(parseTiebreakers(["H2H_POINTS", "H2H_POINTS", "PILE_OU_FACE", "GOALS_FOR"])).toEqual(["H2H_POINTS", "GOALS_FOR"]);
    expect(parseTiebreakers([])).toEqual(["GOAL_DIFF", "GOALS_FOR"]);
  });

  it("statuts : direct, score, reprogrammation", () => {
    expect(isLive("HALF_TIME")).toBe(true);
    expect(isLive("SUSPENDED")).toBe(false);
    expect(hasScore("FINISHED")).toBe(true);
    expect(hasScore("POSTPONED")).toBe(false);
    expect(canReschedule("POSTPONED")).toBe(true);
    expect(canReschedule("LIVE")).toBe(false);
    expect(canReschedule("FINISHED")).toBe(false);
  });

  it("saison suivante : maintenus, promus d'en dessous, relégués d'au-dessus", () => {
    const l1 = [
      { clubId: 1, outcome: "CHAMPION" as const },
      { clubId: 2, outcome: null },
      { clubId: 3, outcome: "RELEGATED" as const },
      { clubId: 4, outcome: "WITHDRAWN" as const },
    ];
    const l2 = [
      { clubId: 10, outcome: "PROMOTED" as const },
      { clubId: 11, outcome: "MAINTAINED" as const },
    ];
    expect(nextSeasonClubs(l1, l2, [])).toEqual([1, 2, 10]);
    // Ligue 2 : ses maintenus + les relégués de Ligue 1 ; ses promus partent.
    expect(nextSeasonClubs(l2, [], l1)).toEqual([11, 3]);
  });

  it("zones du classement : montée en tête, descente en bas, réglables par saison", () => {
    const spots = { promotion: 2, relegation: 3 };
    expect([1, 2, 3, 13, 14, 16].map((r) => standingZone(r, 16, spots))).toEqual(["promotion", "promotion", null, null, "relegation", "relegation"]);
    expect(standingZone(1, 16, { promotion: 0, relegation: 0 })).toBeNull();
  });

  it("pénalité de points et barème paramétrable", () => {
    const table = standings(
      [1, 2],
      [{ homeClubId: 1, awayClubId: 2, homeScore: 2, awayScore: 0, kickoffAt: null }],
      { win: 2, draw: 1, loss: 0 },
      new Map([[1, 3]]),
    );
    expect(table.find((r) => r.clubId === 1)?.points).toBe(-1);
    expect(table[0].clubId).toBe(2);
  });

  it("meilleurs buteurs sans les buts contre son camp", () => {
    expect(
      topScorers([
        { type: "GOAL", playerId: 7 },
        { type: "PENALTY_GOAL", playerId: 7 },
        { type: "GOAL", playerId: 9 },
        { type: "OWN_GOAL", playerId: 9 },
        { type: "RED_CARD", playerId: 9 },
      ]),
    ).toEqual([
      { playerId: 7, goals: 2 },
      { playerId: 9, goals: 1 },
    ]);
  });
});

describe("Coupes à élimination directe (EF-CMP-08)", () => {
  it("8 équipes : 4 + 2 + 1 matchs", () => {
    const bracket = buildBracket([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(bracket.filter((b) => b.round === 1)).toHaveLength(4);
    expect(bracket.filter((b) => b.round === 3)).toHaveLength(1);
    expect(bracket[0]).toEqual({ round: 1, slot: 0, home: 1, away: 2 });
    expect(roundCount(8)).toBe(3);
  });

  it("6 équipes : deux exemptés au premier tour", () => {
    const bracket = buildBracket([1, 2, 3, 4, 5, 6]);
    const first = bracket.filter((b) => b.round === 1);
    expect(first).toHaveLength(4);
    expect(first.filter((b) => b.away === null)).toHaveLength(2);
    // Répartis dans les deux moitiés du tableau : ils ne se rencontrent pas en demi-finale.
    expect(first.filter((b) => b.away === null).map((b) => nextSlot(b.round, b.slot).slot)).toEqual([0, 1]);
    expect(first.flatMap((b) => [b.home, b.away]).filter((x) => x !== null).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("le vainqueur alimente le bon créneau du tour suivant", () => {
    expect(nextSlot(1, 0)).toEqual({ round: 2, slot: 0, side: "home" });
    expect(nextSlot(1, 3)).toEqual({ round: 2, slot: 1, side: "away" });
  });

  it("vainqueur : au score, puis aux tirs au but ; exempt qualifié d'office", () => {
    const m = { homeClubId: 1, awayClubId: 2, homePenalties: null, awayPenalties: null };
    expect(knockoutWinner({ ...m, homeScore: 2, awayScore: 1 })).toBe(1);
    expect(knockoutWinner({ ...m, homeScore: 1, awayScore: 1 })).toBeNull();
    expect(knockoutWinner({ ...m, homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 })).toBe(2);
    expect(knockoutWinner({ homeClubId: 5, awayClubId: null, homeScore: null, awayScore: null, homePenalties: null, awayPenalties: null })).toBe(5);
  });

  it("libellés des tours", () => {
    expect([1, 2, 3, 4].map((r) => roundLabel(r, 4))).toEqual(["Huitièmes de finale", "Quarts de finale", "Demi-finales", "Finale"]);
  });

  it("tirage au sort : permutation complète", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const drawn = shuffle([1, 2, 3, 4, 5, 6, 7, 8], random);
    expect([...drawn].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(drawn).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("Compositions d'équipe (EF-CMP-07)", () => {
  const eligible = new Set(Array.from({ length: 25 }, (_, i) => i + 1));
  const kickoffAt = new Date("2026-10-10T15:00:00Z");
  const now = new Date("2026-10-10T12:00:00Z");
  const team = (starters: number, subs: number) => [
    ...Array.from({ length: starters }, (_, i) => ({ playerId: i + 1, starter: true, shirtNumber: i + 1 })),
    ...Array.from({ length: subs }, (_, i) => ({ playerId: starters + i + 1, starter: false, shirtNumber: starters + i + 1 })),
  ];
  const check = (entries: ReturnType<typeof team>, extra: Partial<{ kickoffAt: Date; now: Date }> = {}) =>
    lineupError(entries, { eligible, kickoffAt, now, ...extra });

  it("11 titulaires et jusqu'à 9 remplaçants", () => {
    expect(check(team(11, 7))).toBeNull();
    expect(check(team(10, 7))).toMatch(/11 titulaires/);
    expect(check(team(11, 10))).toMatch(/9 remplaçants/);
  });

  it("joueurs licenciés uniquement, numéros uniques", () => {
    const entries = team(11, 2);
    expect(check([...entries.slice(0, 12), { playerId: 99, starter: false, shirtNumber: 40 }])).toMatch(/sans licence/);
    entries[12].shirtNumber = 1;
    expect(check(entries)).toMatch(/même numéro/);
  });

  it("verrouillée au coup d'envoi", () => {
    expect(check(team(11, 0), { now: new Date("2026-10-10T15:00:00Z") })).toMatch(/commencé/);
  });
});

describe("nom d'une division nationale", () => {
  it("ajoute « National » sauf à un nom déjà officiel", () => {
    expect(divisionName("Ligue 2")).toBe("Ligue 2 National");
    expect(divisionName("Direct Ligue 1")).toBe("Direct Ligue 1");
    expect(divisionName("Ligue 1 National")).toBe("Ligue 1 National");
  });
});

describe("statut et format affichés sur le portail", () => {
  it("respecte le statut enregistré ; « à venir » tant qu'aucun match n'a commencé", () => {
    expect(publicStatus("ONGOING", 0)).toBe("UPCOMING");
    expect(publicStatus("ONGOING", 3)).toBe("ONGOING");
    // Terminée par l'organisateur : jamais « à venir », même sans match joué.
    expect(publicStatus("FINISHED", 0)).toBe("FINISHED");
    expect(publicStatusLabel("ONGOING", 0)).toBe("À venir");
  });

  it("décrit le format configuré", () => {
    expect(formatLabel({ type: "LEAGUE", doubleRound: true }, 1)).toBe("Championnat à points (aller-retour)");
    expect(formatLabel({ type: "LEAGUE", doubleRound: false }, 2)).toBe("Championnat en 2 poules (aller simple)");
    expect(formatLabel({ type: "CUP", doubleRound: true }, 0)).toBe("Coupe à élimination directe");
  });
});

describe("minute de jeu en direct", () => {
  it("passe d'une période à l'autre au coup d'envoi et à la reprise", () => {
    expect(nextPeriod({ status: "SCHEDULED", period: null }, { status: "LIVE", period: null })).toEqual({ period: 1, restart: true });
    expect(nextPeriod({ status: "HALF_TIME", period: 1 }, { status: "LIVE", period: null })).toEqual({ period: 2, restart: true });
    // Mise à jour du score pendant le jeu : le chronomètre continue.
    expect(nextPeriod({ status: "LIVE", period: 2 }, { status: "LIVE", period: null })).toEqual({ period: 2, restart: false });
    // Prolongation choisie par l'officiel.
    expect(nextPeriod({ status: "HALF_TIME", period: 2 }, { status: "LIVE", period: 3 })).toEqual({ period: 3, restart: true });
    // Pause : la période est conservée, le chronomètre s'arrête.
    expect(nextPeriod({ status: "LIVE", period: 1 }, { status: "HALF_TIME", period: null })).toEqual({ period: 1, restart: false });
  });

  it("affiche la minute, avec le temps additionnel", () => {
    const start = new Date("2026-11-13T13:00:00Z");
    const at = (min: number) => new Date(start.getTime() + min * 60_000);
    expect(liveMinute(1, start, at(0))).toBe("1'");
    expect(liveMinute(1, start, at(36.5))).toBe("37'");
    expect(liveMinute(1, start, at(46))).toBe("45+2'");
    expect(liveMinute(2, start, at(10))).toBe("56'");
    expect(liveMinute(4, start, at(3))).toBe("109'");
    expect(liveMinute(null, start, at(3))).toBeNull();
  });
});

describe("statut public et historique d'un match", () => {
  it("regroupe la mi-temps avec le direct", () => {
    expect(publicMatchStatus("HALF_TIME")).toBe("LIVE");
    expect(publicMatchStatus("SCHEDULED")).toBe("UPCOMING");
    expect(publicMatchStatus("POSTPONED")).toBe("POSTPONED");
  });

  it("raconte le match sans détail interne", () => {
    const t = (h: number) => new Date(Date.UTC(2026, 10, 13, h));
    const history = matchHistory([
      { action: "MATCH_SHEET", createdAt: t(13), details: { before: { status: "SCHEDULED" }, after: { status: "LIVE", score: [0, 0] }, validated: false } },
      { action: "SCHEDULE", createdAt: t(9), details: { before: { kickoffAt: null }, after: { kickoffAt: "2026-11-13T13:00:00.000Z" } } },
      { action: "MATCH_SHEET", createdAt: t(14), details: { before: { status: "LIVE" }, after: { status: "HALF_TIME", score: [1, 0] }, validated: false } },
      { action: "MATCH_SHEET", createdAt: t(15), details: { before: { status: "HALF_TIME" }, after: { status: "FINISHED", score: [2, 1] }, validated: false } },
      { action: "RESULT_VALIDATED", createdAt: t(16), details: { score: [2, 1] } },
      { action: "RESULT_CORRECTION", createdAt: t(17), details: { before: { status: "FINISHED" }, after: { status: "FINISHED", score: [2, 2] }, validated: true } },
      { action: "LINEUP", createdAt: t(12), details: { clubId: 1 } },
    ]);
    expect(history.map((h) => h.label)).toEqual([
      "Match programmé",
      "Coup d'envoi",
      "Mi-temps",
      "Fin du match",
      "Résultat validé par l'organisateur",
      "Résultat corrigé par l'organisateur : 2 – 2",
    ]);
    expect(history[0].kickoffAt?.toISOString()).toBe("2026-11-13T13:00:00.000Z");
  });
});

describe("catégories de matchs du portail", () => {
  const base = { gender: "M" as const, category: "SENIOR" as const, leagueId: null, type: "LEAGUE" as const, tier: null };
  it("classe chaque compétition selon sa configuration", () => {
    expect(competitionFamily({ ...base, tier: 1 })).toBe("ligue-1");
    expect(competitionFamily({ ...base, tier: 2 })).toBe("ligue-2");
    expect(competitionFamily({ ...base, leagueId: 4 })).toBe("departementales");
    expect(competitionFamily({ ...base, type: "CUP" })).toBe("coupes");
    expect(competitionFamily(base)).toBe("autres");
  });
  it("ne confond pas féminin, jeunes et divisions", () => {
    expect(competitionFamily({ ...base, gender: "F", tier: 1 })).toBe("feminin");
    expect(competitionFamily({ ...base, category: "U17", leagueId: 4 })).toBe("jeunes");
    expect(competitionFamily({ ...base, category: "VETERAN", leagueId: 4 })).toBe("departementales");
  });
});

describe("composition sur le terrain", () => {
  const xi = (gk: number, d: number, m: number, f: number) =>
    [
      ...Array(gk).fill("GOALKEEPER"),
      ...Array(d).fill("DEFENDER"),
      ...Array(m).fill("MIDFIELDER"),
      ...Array(f).fill("FORWARD"),
    ].map((position, i) => ({ id: i, position }));
  it("déduit le système des postes des titulaires", () => {
    expect(pitchLines(xi(1, 4, 4, 2)).formation).toBe("4-4-2");
    expect(pitchLines(xi(1, 4, 3, 3)).formation).toBe("4-3-3");
    expect(pitchLines(xi(1, 4, 3, 3)).lines[0]).toHaveLength(1);
  });
  it("place un poste inconnu au milieu et ne devine rien sur une liste incomplète", () => {
    const r = pitchLines([...xi(1, 4, 3, 2), { id: 99, position: null }]);
    expect(r.formation).toBe("4-4-2");
    expect(pitchLines(xi(1, 2, 1, 0)).formation).toBeNull();
  });
});

describe("avant-match", () => {
  it("compte les séries en cours", () => {
    expect(streaks(["V", "V", "N", "V"])).toEqual({ wins: 2, unbeaten: 4 });
    expect(streaks(["D", "V"])).toEqual({ wins: 0, unbeaten: 0 });
    expect(streaks([])).toEqual({ wins: 0, unbeaten: 0 });
  });

  it("répartit les buts par tranche de 15 minutes", () => {
    const r = goalBuckets(
      [
        { type: "GOAL", minute: 3, clubId: 1 },
        { type: "PENALTY_GOAL", minute: 45, clubId: 1 },
        { type: "GOAL", minute: 47, clubId: 2 },
        { type: "OWN_GOAL", minute: 92, clubId: 2 },
        { type: "YELLOW_CARD", minute: 10, clubId: 1 },
      ],
      1,
    );
    expect(r.scored).toEqual([1, 0, 1, 0, 0, 1]);
    expect(r.conceded).toEqual([0, 0, 0, 1, 0, 0]);
  });
});

describe("fichier agenda d'un match", () => {
  it("échappe le texte et fixe une durée de 2 heures", async () => {
    const { matchCalendar } = await import("@/lib/ics");
    const ics = matchCalendar(
      { uid: "match-1", start: new Date("2026-11-13T13:00:00Z"), summary: "Comores – Congo", description: "Éliminatoires; journée 3", location: "Stade Malouzini, Moroni", url: "https://exemple.cg/matchs/1" },
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20261113T130000Z");
    expect(ics).toContain("DTEND:20261113T150000Z");
    expect(ics).toContain("LOCATION:Stade Malouzini\\, Moroni");
    expect(ics).toContain("DESCRIPTION:Éliminatoires\; journée 3");
  });
});

describe("bilan d'une équipe", () => {
  it("compte les résultats, les buts et la série de matchs avec un but", () => {
    const t = recordTotals([
      { goalsFor: 2, goalsAgainst: 1 },
      { goalsFor: 1, goalsAgainst: 1 },
      { goalsFor: 0, goalsAgainst: 3 },
      { goalsFor: 4, goalsAgainst: 0 },
    ]);
    expect(t).toEqual({ played: 4, wins: 2, draws: 1, losses: 1, goalsFor: 7, goalsAgainst: 5, scoringRun: 2 });
  });
});

describe("classement d'un groupe", () => {
  const d = (n: number) => new Date(Date.UTC(2026, 8, n));
  const teams = ["Cameroun", "Comores", "Namibie", "Congo"];
  const played = [
    { home: "Namibie", away: "Congo", homeGoals: 1, awayGoals: 0, date: d(24) },
    { home: "Congo", away: "Cameroun", homeGoals: 1, awayGoals: 1, date: d(29) },
  ];
  it("classe aux points avec les seuls résultats saisis", () => {
    const t = groupTable(teams, played);
    expect(t.map((r) => [r.team, r.points, r.played])).toEqual([
      ["Namibie", 3, 1],
      ["Cameroun", 1, 1],
      ["Congo", 1, 2],
      ["Comores", 0, 0],
    ]);
    expect(t.find((r) => r.team === "Congo")?.form).toEqual(["D", "N"]);
  });
  it("sépare domicile et extérieur, sans tenir compte des accents ni de la casse", () => {
    const home = groupTable(teams, [...played, { home: "comores", away: "NAMIBIE", homeGoals: 2, awayGoals: 0, date: d(30) }], "home");
    expect(home.find((r) => r.team === "Congo")).toMatchObject({ played: 1, drawn: 1, points: 1 });
    expect(home.find((r) => r.team === "Comores")).toMatchObject({ played: 1, won: 1, points: 3 });
    expect(home.find((r) => r.team === "Namibie")).toMatchObject({ played: 1, won: 1 });
  });
});

describe("statistiques et système de jeu", () => {
  const empty = { possessionHome: null, shotsHome: null, shotsAway: null, shotsOnTargetHome: null, shotsOnTargetAway: null, cornersHome: null, cornersAway: null, offsidesHome: null, offsidesAway: null, foulsHome: null, foulsAway: null, savesHome: null, savesAway: null };
  it("contrôle les valeurs saisies", () => {
    expect(statsError({ ...empty, possessionHome: 120 })).toMatch(/pourcentage/);
    expect(statsError({ ...empty, shotsHome: 5, shotsOnTargetHome: 7 })).toMatch(/cadrés/);
    expect(statsError({ ...empty, possessionHome: 39, shotsHome: 12, shotsOnTargetHome: 5 })).toBeNull();
  });
  it("n'affiche que les statistiques relevées des deux côtés", () => {
    const rows = statRows({ ...empty, possessionHome: 39, cornersHome: 5, cornersAway: 6, foulsHome: 10 });
    expect(rows).toEqual([
      { label: "Possession", home: 39, away: 61, percent: true },
      { label: "Corners", home: 5, away: 6 },
    ]);
  });
  it("valide le système de jeu", () => {
    expect(formationError("4-3-3")).toBeNull();
    expect(formationError("4-2-3-1")).toBeNull();
    expect(formationError("4-4-3")).toMatch(/10 joueurs/);
    expect(formationError("quatre")).toMatch(/format/);
  });
});
