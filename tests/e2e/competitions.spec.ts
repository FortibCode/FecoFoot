import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { extractLink, latestNotification, seedLicensedPlayers } from "./db";
import { admin, button, createClub, createUser, e2eEmail, expectNoHorizontalScroll, formAlert, formStatus, login, logout, RUN } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Championnat (M07) : engagements, calendrier automatique, programmation, composition (EF-CMP-07),
 * désignations (M08, RG-08), feuille de match par le commissaire au stade (EF-CMP-09),
 * score calculé avec but contre son camp (RG-07), classement, page publique, exports (EF-EXP-01).
 */
test("championnat : du calendrier au classement public", async ({ page, browser }) => {
  const season = seasonOf();
  const clubs = ["Alpha", "Bravo", "Charlie", "Delta"].map((n) => `E2E ${n} ${RUN}`);
  const compName = `E2E Championnat ${RUN}`;

  await login(page, admin());
  for (const c of clubs) await createClub(page, c, { affiliate: true });
  const clubUser = await createUser(page, { fullName: "Secrétariat Alpha E2E", email: e2eEmail("alpha"), role: "CLUB", club: clubs[0] });
  await seedLicensedPlayers(clubs[0], 13, season, `${RUN}A`);
  await seedLicensedPlayers(clubs[1], 3, season, `${RUN}B`);

  // Création et engagements
  await page.goto("/admin/competitions/nouveau");
  await page.fill('input[name="name"]', compName);
  await page.selectOption('select[name="type"]', "LEAGUE");
  await page.locator('input[name="doubleRound"]').uncheck();
  await button(page, "Créer la compétition").click();
  await expect(page).toHaveURL(/\/admin\/competitions\/\d+$/);
  const compUrl = page.url();
  for (const c of clubs) {
    await page.selectOption('select[name="clubId"]', { label: c });
    await button(page, "Engager").click();
    await expect(page.locator("main ul").first()).toContainText(c);
  }

  // Calendrier toutes rondes, aller simple : 4 équipes → 3 journées, 6 matchs.
  await button(page, "Générer le calendrier").click();
  await expect(page.getByText("Journée 3")).toBeVisible();
  await expect(page.getByText("Journée 4")).toHaveCount(0);
  const matchLinks = page.locator('main a[href^="/admin/matchs/"]');
  await expect(matchLinks).toHaveCount(6);
  await expectNoHorizontalScroll(page);

  // Le match Alpha–Bravo (dans un sens ou dans l'autre)
  const target = matchLinks.filter({ hasText: /E2E Alpha/ }).filter({ hasText: /E2E Bravo/ });
  await target.click();
  await expect(page).toHaveURL(/\/admin\/matchs\/\d+$/);
  const matchUrl = page.url();
  const tomorrow = new Date(Date.now() + 86_400_000 + 3600_000).toISOString().slice(0, 10);
  await page.fill('input[name="kickoffAt"]', `${tomorrow}T15:30`);
  await page.fill('input[name="venue"]', "Stade Alphonse Massamba-Débat");
  await button(page, "Programmer").click();
  await expect(formStatus(page)).toContainText("Programmation enregistrée");

  // Un autre match le même jour, pour tester le conflit de désignation.
  await page.goto(compUrl);
  const other = matchLinks.filter({ hasText: /E2E Charlie/ }).filter({ hasText: /E2E Delta/ });
  await other.click();
  await expect(page).toHaveURL(/\/admin\/matchs\/\d+$/);
  const otherUrl = page.url();
  await page.fill('input[name="kickoffAt"]', `${tomorrow}T18:00`);
  await button(page, "Programmer").click();
  await expect(formStatus(page)).toContainText("Programmation enregistrée");

  // Arbitres : registre, ouverture de l'accès de l'arbitre commissaire
  await page.goto("/admin/arbitres");
  for (const [last, first, email] of [["E2EMBEMBA", "Jean", e2eEmail("arbitre")], ["E2EOKO", "Paul", ""]]) {
    await page.fill('input[name="lastName"]', last);
    await page.fill('input[name="firstName"]', first);
    await page.selectOption('select[name="grade"]', "NATIONAL");
    if (email) await page.fill('input[name="email"]', email);
    await button(page, "Ajouter").click();
    await expect(page).toHaveURL(/\/admin\/arbitres\/\d+$/);
    if (email) {
      await button(page, "Ouvrir l'accès à l'espace arbitre").click();
      await expect(page.locator("main")).toContainText("Accès ouvert");
    }
    await page.goto("/admin/arbitres");
  }

  // Désignations : commissaire sur Alpha–Bravo ; le même officiel refusé sur un autre match le même jour (RG-08).
  await page.goto(matchUrl);
  await page.selectOption('select[name="role"]', "COMMISSIONER");
  const mbemba = await page.locator('select[name="refereeId"] option', { hasText: "E2EMBEMBA" }).getAttribute("value");
  await page.selectOption('select[name="refereeId"]', mbemba!);
  await button(page, "Désigner").click();
  await expect(formStatus(page)).toContainText("Désignation enregistrée");
  await page.selectOption('select[name="role"]', "REFEREE");
  const oko = await page.locator('select[name="refereeId"] option', { hasText: "E2EOKO" }).getAttribute("value");
  await page.selectOption('select[name="refereeId"]', oko!);
  await button(page, "Désigner").click();
  await expect(formStatus(page)).toContainText("Désignation enregistrée");
  await page.goto(otherUrl);
  await page.selectOption('select[name="role"]', "REFEREE");
  await page.selectOption('select[name="refereeId"]', oko!);
  await button(page, "Désigner").click();
  await expect(formAlert(page)).toContainText("même jour");
  await logout(page);

  // Composition déposée par le club (EF-CMP-07) : 11 titulaires exigés
  await login(page, clubUser);
  await page.goto(matchUrl);
  await page.getByRole("link", { name: "Saisir la composition" }).click();
  const roles = page.locator('main select[aria-label^="Rôle de"]');
  await expect(roles).toHaveCount(13);
  for (let i = 0; i < 10; i++) await roles.nth(i).selectOption("starter");
  await button(page, "Enregistrer la composition").click();
  await expect(formAlert(page)).toContainText("11 titulaires");
  await roles.nth(10).selectOption("starter");
  await roles.nth(11).selectOption("sub");
  const numbers = page.locator('main input[aria-label^="Numéro de"]');
  for (let i = 0; i < 12; i++) await numbers.nth(i).fill(String(i + 1));
  await button(page, "Enregistrer la composition").click();
  await expect(formStatus(page)).toContainText("Composition enregistrée");
  await logout(page);

  // L'arbitre choisit son mot de passe, puis remplit la feuille de match depuis son téléphone (EF-CMP-09).
  const welcome = await latestNotification(e2eEmail("arbitre"), "account_welcome");
  await page.goto(extractLink(welcome!.body)!);
  await page.fill('input[name="password"]', "ArbitreE2E2026xx");
  await page.fill('input[name="confirm"]', "ArbitreE2E2026xx");
  await button(page, "Enregistrer le mot de passe").click();
  await expect(formStatus(page)).toContainText("a été modifié");
  await login(page, { email: e2eEmail("arbitre"), password: "ArbitreE2E2026xx" });
  await page.goto("/admin/espace-arbitre");
  await expect(page.locator("main")).toContainText("Commissaire");
  await page.getByRole("link", { name: "Remplir la feuille de match" }).click();
  const sheetUrl = page.url();

  const addEvent = async (type: string, minute: number, player: RegExp) => {
    await page.selectOption('select[name="type"]', type);
    await page.fill('input[name="minute"]', String(minute));
    const value = await page.locator('select[name="playerId"] option').filter({ hasText: player }).first().getAttribute("value");
    await page.selectOption('select[name="playerId"]', value!);
    await button(page, "Ajouter").click();
    // Le message de succès reste affiché d'un ajout à l'autre : on attend l'événement lui-même dans la liste.
    await expect(page.locator("main ul li").filter({ hasText: `${minute}'` })).toBeVisible();
  };
  // Alpha marque deux fois ; un défenseur d'Alpha marque contre son camp → 2–1 pour Alpha.
  await addEvent("GOAL", 12, new RegExp(`E2E${RUN}AJ`, "i"));
  await addEvent("PENALTY_GOAL", 55, new RegExp(`E2E${RUN}AK`, "i"));
  await addEvent("OWN_GOAL", 70, new RegExp(`E2E${RUN}AB`, "i"));
  await addEvent("YELLOW_CARD", 80, new RegExp(`E2E${RUN}AC`, "i"));
  await page.selectOption('select[name="status"]', "FINISHED");
  await page.fill('input[name="attendance"]', "4500");
  await page.fill('textarea[name="report"]', "Match disputé, aucun incident.");
  await button(page, "Enregistrer la feuille de match").click();
  await expect(formStatus(page).last()).toContainText("Feuille de match enregistrée");
  await page.reload();
  // Alpha peut recevoir ou se déplacer : 2–1 dans un sens ou dans l'autre.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(`(Alpha ${RUN} 2 – 1 E2E Bravo)|(Bravo ${RUN} 1 – 2 E2E Alpha)`));
  await expectNoHorizontalScroll(page);

  await page.goto("/admin/espace-arbitre");
  await page.fill('textarea[name="report"]', "RAS. Terrain en bon état, organisation satisfaisante.");
  await button(page, "Transmettre le rapport").click();
  await expect(formStatus(page)).toContainText("Rapport transmis");
  // Un arbitre ne gère pas les compétitions.
  await page.goto(compUrl);
  await expect(page).toHaveURL(/acces-refuse/);
  await logout(page);

  // Résultat saisi par le commissaire : officiel seulement après validation par l'organisateur.
  await login(page, admin());
  await page.goto(sheetUrl);
  await expect(page.locator("main")).toContainText("Résultat en attente de validation");
  await button(page, "Valider le résultat").click();
  await expect(formStatus(page).first()).toContainText("Résultat validé");

  // Classement (fédération) puis page publique
  await page.goto(compUrl);
  const firstRow = page.locator("main table tbody tr").first();
  await expect(firstRow).toContainText(clubs[0]);
  await expect(firstRow).toContainText("3"); // 3 points
  const slugLink = await page.getByRole("link", { name: "Page publique" }).getAttribute("href");

  const visitor = await (await browser.newContext()).newPage();
  // La liste publique montre la nouvelle compétition (page calculée à chaque visite, y compris en production).
  await visitor.goto("/competitions");
  await expect(visitor.getByRole("link", { name: new RegExp(compName) })).toBeVisible();
  await visitor.goto(slugLink!);
  await expect(visitor.locator("main table tbody tr").first()).toContainText(clubs[0]);
  await expect(visitor.locator("main")).toContainText("Meilleurs buteurs");

  // Exports (EF-EXP-01)
  const compId = compUrl.split("/").pop();
  const pdf = await page.request.get(`/admin/exports/classement/${compId}?format=pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  const xlsx = await page.request.get(`/admin/exports/classement/${compId}?format=xlsx`);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
});
