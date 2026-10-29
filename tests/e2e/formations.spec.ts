import { expect, test } from "./fixtures";
import { admin, button, createClub, createUser, e2eEmail, formAlert, login, logout, RUN } from "./helpers";

const PDF = { name: "convention.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") };

/** Formation des dirigeants (inscriptions, places, présence) puis subvention sous convention jusqu'à la clôture. */
test("formation et subvention : inscription, présence, convention, versement, justificatif, clôture", async ({ page, browser }) => {
  const clubName = `E2E Club Formation ${RUN}`;
  const title = `E2E Formation ${RUN}`;
  await login(page, admin());
  await createClub(page, clubName, { affiliate: true });
  const clubUser = await createUser(page, { fullName: "Secrétariat E2E Formation", email: e2eEmail("club-formation"), role: "CLUB", club: clubName });

  // Formation de 2 jours, 1 seule place.
  await page.goto("/admin/formations");
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="startDate"]', "2026-11-16");
  await page.fill('input[name="endDate"]', "2026-11-17");
  await page.fill('input[name="capacity"]', "1");
  await button(page, "Créer la formation").click();
  await expect(page).toHaveURL(/\/admin\/formations\/\d+$/);
  const trainingUrl = page.url();

  // Le club inscrit son président ; la formation est alors complète.
  await logout(page);
  await login(page, clubUser);
  await page.goto(trainingUrl);
  await page.fill('input[name="fullName"]', "E2EPRESIDENT Club");
  await button(page, "Inscrire").click();
  await expect(page.locator("main table").first()).toContainText("E2EPRESIDENT Club");
  await page.fill('input[name="fullName"]', "E2ESECRETAIRE Club");
  await page.selectOption('select[name="role"]', "CLUB_SECRETARY");
  await button(page, "Inscrire").click();
  await expect(formAlert(page)).toContainText("complète");

  // La fédération pointe la présence du premier jour.
  await logout(page);
  await login(page, admin());
  await page.goto(trainingUrl);
  await page.getByRole("button", { name: /^Présence de E2EPRESIDENT Club le lun/ }).click();
  await expect(page.getByTestId("tr-Clubs représentés")).toHaveText("1");

  // Subvention : création, convention, signature par le club, validation, versement.
  await page.goto("/admin/subventions");
  await page.selectOption('select[name="trainingId"]', { label: title });
  const option = page.locator('select[name="clubId"] option').filter({ hasText: clubName });
  await expect(option).toContainText("présent à la formation");
  await page.selectOption('select[name="clubId"]', (await option.getAttribute("value"))!);
  await page.fill('input[name="amount"]', "100000");
  await button(page, "Créer la subvention").click();
  await expect(page).toHaveURL(/\/admin\/subventions\/\d+$/);
  const grantUrl = page.url();
  await page.getByLabel("Déposer la convention (PDF) : fichier").setInputFiles(PDF);
  await button(page, "Déposer la convention (PDF)").click();
  await expect(page.locator("main")).toContainText("télécharger");

  await logout(page);
  await login(page, clubUser);
  await page.goto(grantUrl);
  await page.getByLabel("Déposer la convention signée : fichier").setInputFiles({ ...PDF, name: "signee.pdf" });
  await button(page, "Déposer la convention signée").click();
  await expect(page.locator("main")).toContainText("voir");

  await logout(page);
  await login(page, admin());
  await page.goto(grantUrl);
  await button(page, "Valider la convention signée").click();
  await expect(page.getByRole("heading", { level: 1 }).locator("xpath=..")).toContainText("Convention signée");
  await page.fill('input[name="paidAt"]', "2026-11-20");
  await page.fill('input[name="paymentRef"]', "VIR-E2E-001");
  await button(page, "Enregistrer le versement").click();
  await expect(page.locator("main")).toContainText("VIR-E2E-001");

  // Clôture refusée tant que les fonds ne sont pas justifiés.
  await button(page, "Clôturer (fonds justifiés)").click();
  await expect(page.locator("main")).toContainText("Dépenses justifiées insuffisantes");

  // Le club justifie, la fédération accepte puis clôture.
  await logout(page);
  await login(page, clubUser);
  await page.goto(grantUrl);
  await page.fill('input[name="label"]', "Équipements d'entraînement");
  await page.fill('input[name="amount"]', "100000");
  await page.fill('input[name="spentOn"]', "2026-11-25");
  await page.locator('form:has(input[name="label"]) input[type="file"]').setInputFiles({ ...PDF, name: "facture.pdf" });
  await button(page, "Déposer le justificatif").click();
  await expect(page.locator("main table").last()).toContainText("À examiner");

  await logout(page);
  await login(page, admin());
  await page.goto(grantUrl);
  await button(page, "Accepter").click();
  await expect(page.locator("main table").last()).toContainText("Acceptée");
  await button(page, "Clôturer (fonds justifiés)").click();
  await expect(page.getByRole("heading", { level: 1 }).locator("xpath=..")).toContainText("Clôturée");

  // Un autre club ne voit pas ce dossier.
  const other = await (await browser.newContext()).newPage();
  await other.goto(grantUrl);
  await expect(other).toHaveURL(/\/connexion/);
});
