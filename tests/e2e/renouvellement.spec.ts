import { expect, test } from "@playwright/test";
import { seasonOf } from "../../lib/licenses";
import { withDb } from "./db";
import { admin, button, createClub, createUser, e2eEmail, login, logout, RUN } from "./helpers";

/** Renouvellement groupé des licences d'un club (EF-LIC-10). */
test("renouvellement groupé : les licenciés de la saison passée sont renouvelés en une fois", async ({ page }) => {
  const clubName = `E2E Club Renouvellement ${RUN}`;
  const suffix = RUN.replace(/[^a-z]/g, "");
  await login(page, admin());
  await createClub(page, clubName, { affiliate: true });
  const clubUser = await createUser(page, { fullName: "Secrétariat Renouvellement E2E", email: e2eEmail("renouv"), role: "CLUB", club: clubName });

  // Deux joueurs majeurs du club.
  const ids: number[] = [];
  for (const [last, first] of [[`Alpha${suffix}e`, "Jean"], [`Beta${suffix}e`, "Marc"]]) {
    await page.goto("/admin/joueurs/nouveau");
    await page.fill('input[name="lastName"]', last);
    await page.fill('input[name="firstName"]', first);
    await page.fill('input[name="birthDate"]', "1995-02-02");
    await page.selectOption('select[name="gender"]', "M");
    await page.selectOption('select[name="clubId"]', { label: clubName });
    await button(page, "Enregistrer le joueur").click();
    await expect(page).toHaveURL(/\/admin\/joueurs\/\d+$/);
    ids.push(Number(page.url().split("/").pop()));
  }
  await logout(page);

  // Licences validées la saison précédente (impossible à créer par l'interface : on remonte le temps en base).
  const previous = seasonOf() - 1;
  await withDb(async (sql) => {
    const [{ id: clubId }] = await sql<{ id: number }[]>`select id from clubs where name = ${clubName}`;
    for (const [i, playerId] of ids.entries()) {
      await sql`insert into licenses (number, player_id, club_id, season, category, type, status, medical_check_date, fee_amount, expires_at, verify_token)
        values (${`LIC-E2E-${RUN}-${i}`}, ${playerId}, ${clubId}, ${previous}, 'SENIOR', 'AMATEUR', 'VALIDATED', ${`${previous}-08-01`}, 5000,
                ${`${previous + 1}-06-30T22:59:59Z`}, ${`e2e-renewal-token-${RUN}-${i}-xxxxxxxxxx`})`;
    }
  });

  // Le club renouvelle : un joueur sans date de visite médicale est signalé, l'autre est déposé.
  await login(page, clubUser);
  await page.goto("/admin/licences/renouvellement");
  const rows = page.locator("main form > ul > li");
  await expect(rows).toHaveCount(2);
  const medical = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(new RegExp(`Visite médicale de Alpha${suffix}e`, "i")).fill(medical);
  await page.evaluate(() => document.querySelectorAll("[required]").forEach((e) => e.removeAttribute("required")));
  await page.fill('input[name="feeAmount"]', "5000");
  await button(page, "Renouveler 2 licence(s)").click();
  await expect(page.locator("main")).toContainText("1 demande(s) de licence déposée(s)");
  await expect(page.locator("main")).toContainText("date de visite médicale manquante");

  // Le joueur renouvelé disparaît de la liste ; le second peut l'être ensuite.
  await page.reload();
  await expect(rows).toHaveCount(1);
  await page.getByLabel(/Visite médicale de/).fill(medical);
  await page.fill('input[name="feeAmount"]', "5000");
  await button(page, "Renouveler 1 licence(s)").click();
  await expect(page.locator("main")).toContainText("1 demande(s) de licence déposée(s)");
  await page.reload();
  await expect(page.getByText("Aucun joueur à renouveler")).toBeVisible();
});
