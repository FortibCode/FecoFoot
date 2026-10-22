import { expect, test } from "./fixtures";
import { admin, button, createUser, e2eEmail, expectNoHorizontalScroll, login, logout, RUN } from "./helpers";

/**
 * Ligues départementales et championnats nationaux : portail (11 ligues, Ligue 1 et Ligue 2 dans le menu),
 * périmètre d'un compte de ligue (ses compétitions seulement, jamais les championnats nationaux).
 */
test("portail : ligues départementales, Ligue 1 et Ligue 2 nationales", async ({ page }) => {
  await page.goto("/ligues");
  expect(await page.getByTestId("public-league").count()).toBeGreaterThanOrEqual(11);
  await expect(page.locator("main")).toContainText("Ligue départementale du Pool");
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  // Entrées du menu (le pied de page propose aussi ces liens : on vise ceux du menu, affichés en premier).
  const menuLink = (name: RegExp) => page.getByRole("link", { name }).first();
  await expect(menuLink(/^Ligue 1/)).toBeVisible();
  await expect(menuLink(/^Ligue 2/)).toBeVisible();
  await menuLink(/^Ligue 2/).click();
  await expect(page).toHaveURL(/\/championnats\/ligue-2$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Ligue 2/i);

  // API publique en lecture seule.
  const api = await page.request.get("/api/championnats");
  expect(api.ok()).toBe(true);
  const codes = ((await api.json()) as { data: { code: string }[] }).data.map((c) => c.code);
  expect(codes).toEqual(expect.arrayContaining(["ligue-1", "ligue-2"]));
});

test("périmètre : une ligue ne gère que ses compétitions départementales", async ({ page }) => {
  const compName = `E2E Championnat Pool ${RUN}`;
  await login(page, admin());
  // La fédération crée un championnat départemental organisé par la ligue du Pool.
  await page.goto("/admin/competitions/nouveau");
  await page.fill('input[name="name"]', compName);
  await page.selectOption('select[name="leagueId"]', { label: "Ligue départementale du Pool" });
  await button(page, "Créer la compétition").click();
  await expect(page).toHaveURL(/\/admin\/competitions\/\d+$/);
  const compUrl = new URL(page.url()).pathname;

  const pool = await createUser(page, { fullName: "Ligue Pool E2E", email: e2eEmail("ligue-pool"), role: "LEAGUE", league: "Ligue départementale du Pool" });
  const bzv = await createUser(page, { fullName: "Ligue BZV Compet E2E", email: e2eEmail("ligue-bzv-cmp"), role: "LEAGUE", league: "Ligue départementale de Brazzaville" });
  await logout(page);

  // La ligue organisatrice gère sa compétition, mais pas les championnats nationaux.
  await login(page, pool);
  await page.goto(compUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(compName);
  await expect(page.getByRole("navigation", { name: "Modules" })).not.toContainText("Championnats nationaux");
  await page.goto("/admin/championnats");
  await expect(page).toHaveURL(/\/admin\/acces-refuse$/);
  // Sa liste de compétitions est limitée à sa ligue.
  await page.goto("/admin/competitions");
  await expect(page.getByTestId("competition-row").filter({ hasText: compName })).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText("Ligue 1 National");
  await logout(page);

  // Une autre ligue n'y a pas accès, même par l'adresse directe.
  await login(page, bzv);
  await page.goto(compUrl);
  await expect(page).toHaveURL(/\/admin\/acces-refuse$/);
});
