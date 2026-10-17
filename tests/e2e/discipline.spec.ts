import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { seedLicensedPlayers, withDb } from "./db";
import { admin, button, createClub, createUser, e2eEmail, formAlert, formStatus, login, logout, RUN } from "./helpers";

/** Discipline (M18) : suspension automatique, compositions bloquées, décisions de la commission, retrait de points. */
test("discipline : carton rouge, joueur suspendu écarté, décision publiée, retrait de points", async ({ page, browser }) => {
  const clubA = `E2E Disc A ${RUN}`;
  const clubB = `E2E Disc B ${RUN}`;
  const compName = `E2E Coupe Discipline ${RUN}`;
  const tag = `${RUN}D`.toUpperCase();

  await login(page, admin());
  await createClub(page, clubA, { affiliate: true });
  await createClub(page, clubB, { affiliate: true });
  const a = await seedLicensedPlayers(clubA, 13, seasonOf(), `${RUN}D`);
  await seedLicensedPlayers(clubB, 1, seasonOf(), `${RUN}E`);
  const clubUser = await createUser(page, { fullName: "Secrétariat Disc E2E", email: e2eEmail("disc-club"), role: "CLUB", club: clubA });
  const commission = await createUser(page, { fullName: "Commission E2E", email: e2eEmail("commission"), role: "DISCIPLINE" });

  // Championnat aller-retour à 2 clubs : 2 matchs.
  await page.goto("/admin/competitions/nouveau");
  await page.fill('input[name="name"]', compName);
  await button(page, "Créer la compétition").click();
  await expect(page).toHaveURL(/\/admin\/competitions\/\d+$/);
  const compUrl = page.url();
  for (const c of [clubA, clubB]) {
    await page.selectOption('select[name="clubId"]', { label: c });
    await button(page, "Engager").click();
    await expect(page.locator("main ul").first()).toContainText(c);
  }
  await button(page, "Générer le calendrier").click();
  const links = page.locator('main a[href^="/admin/matchs/"]');
  await expect(links).toHaveCount(2);
  const [m1, m2] = await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));

  // Match 1 : carton rouge pour le joueur n°1 d'Alpha, match terminé.
  await page.goto(m1);
  const yesterday = new Date(Date.now() - 86_400_000 + 3_600_000).toISOString().slice(0, 10);
  await page.fill('input[name="kickoffAt"]', `${yesterday}T15:00`);
  await button(page, "Programmer").click();
  await expect(formStatus(page).first()).toContainText("Programmation enregistrée");
  await page.selectOption('select[name="type"]', "RED_CARD");
  await page.fill('input[name="minute"]', "40");
  const redValue = await page.locator('select[name="playerId"] option').filter({ hasText: `E2E${tag}AA` }).getAttribute("value");
  await page.selectOption('select[name="playerId"]', redValue!);
  await button(page, "Ajouter").click();
  await expect(page.locator("main ul li").filter({ hasText: "40'" })).toBeVisible();
  await page.selectOption('select[name="status"]', "FINISHED");
  await button(page, "Enregistrer la feuille de match").click();
  await expect(formStatus(page).last()).toContainText("Feuille de match enregistrée");

  // Match 2 demain.
  await page.goto(m2);
  const tomorrow = new Date(Date.now() + 86_400_000 + 3_600_000).toISOString().slice(0, 10);
  await page.fill('input[name="kickoffAt"]', `${tomorrow}T15:00`);
  await button(page, "Programmer").click();
  await expect(formStatus(page).first()).toContainText("Programmation enregistrée");
  await logout(page);

  // La commission voit la suspension automatique.
  await login(page, commission);
  await page.goto("/admin/discipline");
  await page.selectOption('select[name="competition"]', { label: compName });
  await page.getByRole("button", { name: "Afficher" }).click();
  await expect(page.locator("main table").first()).toContainText("Carton rouge (automatique)");
  await expect(page.locator("main table").first()).toContainText(`E2E${tag}AA`);

  // Dossier : suspension de 2 matchs pour le joueur n°2, décision publiée.
  const federal2 = await withDb(async (sql) => (await sql<{ federal_id: string }[]>`select federal_id from players where id = ${a.playerIds[1]}`)[0].federal_id);
  await page.fill('input[name="federalId"]', federal2);
  await page.fill('textarea[name="facts"]', "Comportement antisportif envers l'arbitre après le coup de sifflet final.");
  await button(page, "Ouvrir le dossier").click();
  await expect(page).toHaveURL(/\/admin\/discipline\/\d+$/);
  await page.selectOption('select[name="sanctionType"]', "MATCH_SUSPENSION");
  await page.fill('input[name="suspensionMatches"]', "2");
  await page.fill('textarea[name="decision"]', "La commission inflige deux matchs de suspension ferme.");
  await button(page, "Rendre la décision").click();
  await expect(page.getByTestId("sanction")).toContainText("2 match(s)");
  await button(page, "Publier la décision").click();
  await expect(page.locator("main")).toContainText("Publiée sur le portail");

  // Retrait de 3 points au club B dans la compétition.
  await page.goto("/admin/discipline");
  await page.selectOption('select[name="clubId"]', { label: clubB });
  await page.selectOption('select[name="competitionId"]', { label: compName });
  await page.fill('textarea[name="facts"]', "Non-présentation des licences des joueurs.");
  await button(page, "Ouvrir le dossier").click();
  await expect(page).toHaveURL(/\/admin\/discipline\/\d+$/);
  await page.selectOption('select[name="sanctionType"]', "POINTS_DEDUCTION");
  await page.fill('input[name="pointsDeducted"]', "3");
  await page.fill('textarea[name="decision"]', "Retrait de trois points au classement.");
  await button(page, "Rendre la décision").click();
  await expect(page.getByTestId("sanction")).toContainText("3 point(s)");
  await logout(page);

  // Le club ne peut pas aligner ses deux joueurs suspendus (EF-DIS-01, EF-CMP-07).
  await login(page, clubUser);
  await page.goto(`${m2}/composition/${a.clubId}`);
  const suspendedRows = page.locator("main li").filter({ hasText: "Suspendu" });
  await expect(suspendedRows).toHaveCount(2);
  await expect(suspendedRows.first().locator("select")).toBeDisabled();
  // Contournement de l'interface : le serveur refuse quand même.
  await page.evaluate(() => document.querySelectorAll("select:disabled").forEach((s) => s.removeAttribute("disabled")));
  const roles = page.locator('main select[aria-label^="Rôle de"]');
  for (let i = 0; i < 11; i++) await roles.nth(i).selectOption("starter");
  await button(page, "Enregistrer la composition").click();
  await expect(formAlert(page)).toContainText("suspendu");
  await logout(page);

  // Portail : décision publiée ; classement : retrait de points appliqué.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/discipline");
  await expect(visitor.locator("main")).toContainText("deux matchs de suspension ferme");
  await login(page, admin());
  await page.goto(compUrl);
  await expect(page.locator("main ul").first()).toContainText("−3 pts");
});
