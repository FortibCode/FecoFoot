import { expect, test } from "./fixtures";
import { admin, button, createClub, createUser, e2eEmail, formAlert, login, logout, RUN } from "./helpers";

/** Transfert définitif : la ligue instruit, la fédération approuve, la licence de la saison est close (M06, RG-06). */
test("transfert : instruction par la ligue, approbation fédérale, clôture de la licence", async ({ page }) => {
  const clubA = `E2E Club Départ ${RUN}`;
  const clubB = `E2E Club Accueil ${RUN}`;
  const lastName = `Transfert${RUN.replace(/[^a-z]/g, "")}e2e`;

  // ── Préparation (fédération) : deux clubs affiliés, un joueur majeur avec une licence encaissée
  await login(page, admin());
  await createClub(page, clubA, { affiliate: true });
  await createClub(page, clubB, { affiliate: true });
  const league = await createUser(page, { fullName: "Ligue Transferts E2E", email: e2eEmail("ligue-trf"), role: "LEAGUE", league: "Ligue de Brazzaville" });
  const releasingClub = await createUser(page, { fullName: "Club Départ E2E", email: e2eEmail("club-depart"), role: "CLUB", club: clubA });

  // Fenêtre de transfert ouverte aujourd'hui (EF-TRF-04).
  const today = new Date().toISOString().slice(0, 10);
  await page.goto("/admin/transferts/fenetres");
  await page.fill('input[name="name"]', `E2E fenêtre ${RUN}`);
  await page.fill('input[name="opensOn"]', today);
  await page.fill('input[name="closesOn"]', today);
  await button(page, "Ajouter la fenêtre").click();
  await expect(page.locator("main li").filter({ hasText: `E2E fenêtre ${RUN}` })).toBeVisible();

  await page.goto("/admin/joueurs/nouveau");
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="firstName"]', "Paul");
  await page.fill('input[name="birthDate"]', "1998-04-10");
  await page.selectOption('select[name="gender"]', "M");
  await page.fill('input[name="phone"]', "+242 05 000 00 00");
  await page.selectOption('select[name="clubId"]', { label: clubA });
  await button(page, "Enregistrer le joueur").click();
  await expect(page).toHaveURL(/\/admin\/joueurs\/\d+$/);
  const playerUrl = page.url();
  const federalId = (await page.locator("main").textContent())!.match(/FCF-J-\d{4}-\d{6}/)![0];

  await page.fill('input[name="medicalCheckDate"]', new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10));
  await page.fill('input[name="feeAmount"]', "10000");
  await button(page, "Déposer la demande de licence").click();
  await expect(page).toHaveURL(/\/admin\/licences\/\d+$/);
  const licenseUrl = page.url();
  await button(page, "Enregistrer l'encaissement").click();
  await expect(page.locator("main")).toContainText("Droits encaissés");
  await logout(page);

  // ── La ligue saisit la demande
  await login(page, league);
  await page.goto(`/admin/transferts/nouveau?joueur=${federalId}`);
  await expect(page.locator('input[name="federalId"]')).toHaveValue(federalId);
  await page.selectOption('select[name="toClubId"]', { label: clubB });
  await page.selectOption('select[name="type"]', "LOAN");
  await page.evaluate(() => document.querySelectorAll("[required]").forEach((e) => e.removeAttribute("required")));
  await button(page, "Enregistrer la demande").click();
  await expect(formAlert(page)).toContainText("date de fin de prêt est obligatoire");

  await page.selectOption('select[name="type"]', "DEFINITIVE");
  await page.fill('input[name="fee"]', "250000");
  await button(page, "Enregistrer la demande").click();
  await expect(page).toHaveURL(/\/admin\/transferts\/\d+$/);
  const transferUrl = page.url();
  await expect(page.locator("main")).toContainText("En instruction");

  // Un seul transfert en cours par joueur (EF-TRF-02).
  await page.goto(`/admin/transferts/nouveau?joueur=${federalId}`);
  await page.selectOption('select[name="toClubId"]', { label: clubB });
  await button(page, "Enregistrer la demande").click();
  await expect(formAlert(page)).toContainText("déjà en cours");

  // Sans l'accord du club quitté, la ligue ne peut pas transmettre (EF-TRF-05).
  await page.goto(transferUrl);
  await page.locator("form").filter({ has: button(page, "Transmettre à la fédération") }).locator('input[name="text"]').fill("Avis favorable.");
  await button(page, "Transmettre à la fédération").click();
  await expect(formAlert(page)).toContainText("club quitté n'a pas donné son accord");
  await logout(page);

  // Le club quitté donne son accord de sortie.
  await login(page, releasingClub);
  await page.goto("/admin/transferts");
  await expect(page.locator("main")).toContainText("Accord du club quitté attendu");
  await page.goto(transferUrl);
  await button(page, "Donner l'accord de sortie").click();
  await expect(page.locator("main")).toContainText("Accordé");
  await logout(page);

  // Instruction : la ligue transmet, mais ne peut pas approuver.
  await login(page, league);
  await page.goto(transferUrl);
  await page.fill('input[name="text"]', "Dossier complet, avis favorable.");
  await button(page, "Transmettre à la fédération").click();
  await expect(page.locator("main")).toContainText("Transmis à la fédération");
  await expect(button(page, "Approuver le transfert")).toHaveCount(0);
  await logout(page);

  // ── La fédération approuve
  await login(page, admin());
  await page.goto(transferUrl);
  await expect(page.locator("main")).toContainText("Dossier complet, avis favorable.");
  await button(page, "Approuver le transfert").click();
  await expect(page.locator("main")).toContainText("Approuvé");
  await page.getByRole("link", { name: "Certificat de sortie" }).click();
  await expect(page.getByRole("article", { name: "Certificat de sortie" })).toContainText(federalId);

  // Le joueur a changé de club, sa licence de la saison est close, une nouvelle demande est possible.
  await page.goto(playerUrl);
  await expect(page.locator("main header, main > div").first()).toContainText(clubB);
  await expect(page.locator("main table")).toContainText("Close (transfert)");
  await expect(button(page, "Déposer la demande de licence")).toBeVisible();
  await page.goto(licenseUrl);
  await expect(page.locator("main")).toContainText("Close (transfert)");
});
