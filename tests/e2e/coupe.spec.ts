import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { seedLicensedPlayers } from "./db";
import { admin, button, createClub, formAlert, formStatus, login, RUN } from "./helpers";

/** Coupe à élimination directe (EF-CMP-08) : tirage, exemptés, tirs au but, qualification au tour suivant. */
test("coupe : tirage au sort, exemptés et qualification aux tirs au but", async ({ page }) => {
  const clubs = ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six"].map((n) => `E2E Coupe ${n} ${RUN}`);
  await login(page, admin());
  for (const c of clubs) await createClub(page, c, { affiliate: true });
  for (const [i, c] of clubs.entries()) await seedLicensedPlayers(c, 1, seasonOf(), `${RUN}C${i}`);

  await page.goto("/admin/competitions/nouveau");
  await page.fill('input[name="name"]', `E2E Coupe du Congo ${RUN}`);
  await page.selectOption('select[name="type"]', "CUP");
  await button(page, "Créer la compétition").click();
  await expect(page).toHaveURL(/\/admin\/competitions\/\d+$/);
  const compUrl = page.url();
  for (const c of clubs) {
    await page.selectOption('select[name="clubId"]', { label: c });
    await button(page, "Engager").click();
    await expect(page.locator("main ul").first()).toContainText(c);
  }
  await button(page, "Effectuer le tirage au sort").click();

  // 6 équipes → tableau de 8 : quarts (dont 2 exemptés), demi-finales, finale.
  await expect(page.getByText("Quarts de finale")).toBeVisible();
  await expect(page.getByText("Demi-finales")).toBeVisible();
  await expect(page.getByText("Finale", { exact: true })).toBeVisible();
  const quarter = page.locator("main div.overflow-hidden").filter({ hasText: "Quarts de finale" });
  await expect(quarter.getByText("exempt")).toHaveCount(2);
  // Les exemptés figurent déjà en demi-finale, chacun dans une moitié du tableau.
  const semis = page.locator("main div.overflow-hidden").filter({ hasText: "Demi-finales" });
  await expect(semis.locator("a").filter({ hasText: /E2E Coupe/ })).toHaveCount(2);

  // Un quart de finale réellement joué : nul 1–1, qualification aux tirs au but.
  const played = quarter.locator("a").filter({ hasNotText: "exempt" }).first();
  await played.click();
  await expect(page).toHaveURL(/\/admin\/matchs\/\d+$/);
  const [homeName, awayName] = (await page.getByRole("heading", { level: 1 }).textContent())!.split(/\s+–\s+/).map((s) => s.trim());
  const goal = async (minute: number, team: string) => {
    await page.selectOption('select[name="type"]', "GOAL");
    await page.fill('input[name="minute"]', String(minute));
    const value = await page.locator(`select[name="playerId"] optgroup[label="${team}"] option`).first().getAttribute("value");
    await page.selectOption('select[name="playerId"]', value!);
    await button(page, "Ajouter").click();
    await expect(page.locator("main ul li").filter({ hasText: `${minute}'` })).toBeVisible();
  };
  await goal(20, homeName);
  await goal(75, awayName);
  await page.selectOption('select[name="status"]', "FINISHED");
  await button(page, "Enregistrer la feuille de match").click();
  await expect(formAlert(page).last()).toContainText("tirs au but");
  await page.fill('input[name="homePenalties"]', "3");
  await page.fill('input[name="awayPenalties"]', "4");
  await button(page, "Enregistrer la feuille de match").click();
  await expect(formStatus(page).last()).toContainText("Feuille de match enregistrée");

  // Le vainqueur aux tirs au but (l'équipe à l'extérieur) est qualifié pour la demi-finale.
  await page.goto(compUrl);
  await expect(semis.locator("a").filter({ hasText: awayName })).toBeVisible();
  await expect(quarter.getByText("t.a.b. 3–4")).toBeVisible();
});
