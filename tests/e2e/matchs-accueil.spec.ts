import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { withDb } from "./db";
import { admin, createClub, expectNoHorizontalScroll, login, RUN } from "./helpers";

/**
 * Matchs sur le portail : mise « à la une » par l'organisateur, onglets par catégorie de la page
 * d'accueil, filtres de la page « Matchs et résultats », fiche du match avec la minute de jeu.
 */
test("matchs : à la une, catégories de l'accueil, filtres et fiche en direct", async ({ page, browser }) => {
  const [home, away] = [`E2E Lions ${RUN}`, `E2E Aigles ${RUN}`];
  await login(page, admin());
  for (const c of [home, away]) await createClub(page, c, { affiliate: true });

  // Coupe nationale en cours, match en direct depuis 10 minutes (1re mi-temps), score 1-0.
  const matchId = await withDb(async (sql) => {
    const clubs = await sql<{ id: number; name: string }[]>`select id, name from clubs where name in (${home}, ${away})`;
    const id = (n: string) => clubs.find((c) => c.name === n)!.id;
    const [comp] = await sql<{ id: number }[]>`
      insert into competitions (name, slug, season, category, type, status)
      values (${`E2E Coupe nationale ${RUN}`}, ${`e2e-coupe-nationale-${RUN}`}, ${seasonOf()}, 'SENIOR', 'CUP', 'ONGOING') returning id`;
    await sql`insert into competition_teams (competition_id, club_id) values (${comp.id}, ${id(home)}), (${comp.id}, ${id(away)})`;
    const [m] = await sql<{ id: number }[]>`
      insert into matches (competition_id, round, bracket_slot, home_club_id, away_club_id, kickoff_at, venue, status, home_score, away_score, period, period_started_at)
      values (${comp.id}, 1, 1, ${id(home)}, ${id(away)}, now() - interval '10 minutes', 'Stade E2E, Brazzaville', 'LIVE', 1, 0, 1, now() - interval '10 minutes')
      returning id`;
    return m.id;
  });

  // L'organisateur met le match à la une.
  await page.goto(`/admin/matchs/${matchId}`);
  await page.getByRole("button", { name: "Mettre à la une" }).click();
  await expect(page.getByRole("button", { name: "À la une" })).toHaveAttribute("aria-pressed", "true");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/");
  const section = visitor.locator("section", { has: visitor.locator("#matchs-title") });
  await expect(section.getByRole("heading", { name: "À la une" })).toBeVisible();
  await expect(section.getByRole("link", { name: new RegExp(home, "i") }).first()).toBeVisible();
  // Onglet « Coupes » (catégorie de la compétition), ouvert d'office : il contient un match en direct.
  const tab = section.getByRole("tab", { name: /Coupes/ });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(section.getByRole("tabpanel")).toContainText(away, { ignoreCase: true });
  await expectNoHorizontalScroll(visitor);

  // Fiche du match : score en direct et minute de jeu (10 minutes écoulées : 11e minute, à une minute près).
  await section.getByRole("tabpanel").getByRole("link", { name: new RegExp(home, "i") }).click();
  await expect(visitor).toHaveURL(new RegExp(`/matchs/${matchId}$`));
  const score = visitor.getByRole("region", { name: "Score" });
  await expect(score).toContainText("1 - 0");
  await expect(score).toContainText(/1[1-3]'/);

  // Page complète : catégorie, statut, et une catégorie sans ce match.
  await visitor.goto("/matchs?categorie=coupes&statut=direct");
  await expect(visitor.locator("main")).toContainText(home, { ignoreCase: true });
  await visitor.goto("/matchs?categorie=ligue-2");
  // Le club reste proposé dans le filtre « Équipe » : on vérifie l'absence du match lui-même.
  await expect(visitor.getByRole("link", { name: "Voir tous les matchs" })).toBeVisible();
  await expect(visitor.locator(`a[href="/matchs/${matchId}"]`)).toHaveCount(0);
  await expectNoHorizontalScroll(visitor);
});
