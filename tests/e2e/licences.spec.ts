import { expect, test } from "./fixtures";
import { latestNotification } from "./db";
import { admin, button, createClub, createUser, e2eEmail, expectNoHorizontalScroll, formAlert, formStatus, login, logout, RUN } from "./helpers";

/**
 * Scénarios de recette §10.2 :
 *  1. un club enregistre un joueur mineur et demande sa licence ; accord envoyé au tuteur ;
 *     validation bloquée tant que l'accord manque ;
 *  2. la ligue valide la licence après accord et paiement ; carte QR ; vérification publique « Licence valide ».
 */
test("licence d'un joueur mineur : de l'enregistrement à la vérification publique", async ({ page, browser }) => {
  const clubName = `E2E Club Licences ${RUN}`;
  // Nom unique par exécution (lettres uniquement : la clé anti-doublon ignore chiffres et accents).
  const lastName = `Mineur${RUN.replace(/[^a-z]/g, "")}e2e`;
  const birthDate = "2011-03-15"; // 15 ans pour la saison 2026-2027 → catégorie U17

  // Préparation : club affilié et compte du secrétariat du club.
  await login(page, admin());
  await createClub(page, clubName, { affiliate: true, shortName: "E2E" });
  const clubUser = await createUser(page, { fullName: "Secrétariat E2E", email: e2eEmail("club"), role: "CLUB", club: clubName });
  await logout(page);

  // ── Le club enregistre un joueur mineur
  await login(page, clubUser);
  await page.goto("/admin/joueurs/nouveau");
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="firstName"]', "Élie");
  await page.fill('input[name="birthDate"]', birthDate);
  await page.selectOption('select[name="gender"]', "M");
  await page.selectOption('select[name="position"]', "FORWARD");
  // Contrôle serveur : on retire la validation du navigateur.
  await page.evaluate(() => document.querySelectorAll("[required]").forEach((e) => e.removeAttribute("required")));
  await button(page, "Enregistrer le joueur").click();
  await expect(page.locator("main")).toContainText("Représentant légal obligatoire");
  await expect(page.locator('input[name="lastName"]')).toHaveValue(lastName);

  await page.fill('input[name="guardianName"]', "Parent E2E");
  await page.fill('input[name="guardianPhone"]', "+242 06 000 00 00");
  await button(page, "Enregistrer le joueur").click();
  await expect(page).toHaveURL(/\/admin\/joueurs\/\d+$/);
  const playerUrl = page.url();
  const federalId = (await page.locator("main").textContent())?.match(/FCF-J-\d{4}-\d{6}/)?.[0];
  expect(federalId).toBeTruthy();

  // Doublon : même identité, casse et accents différents.
  await page.goto("/admin/joueurs/nouveau");
  await page.fill('input[name="lastName"]', lastName.toLowerCase());
  await page.fill('input[name="firstName"]', "ELIE");
  await page.fill('input[name="birthDate"]', birthDate);
  await page.selectOption('select[name="gender"]', "M");
  await page.fill('input[name="guardianName"]', "X");
  await page.fill('input[name="guardianPhone"]', "1");
  await button(page, "Enregistrer le joueur").click();
  await expect(formAlert(page)).toContainText(federalId!);

  // ── Photo et pièces justificatives : le type réel du fichier est contrôlé
  await page.goto(playerUrl);
  const upload = async (label: string, file: { name: string; mimeType: string; buffer: Buffer }) => {
    const row = page.locator("main li").filter({ hasText: label });
    await row.locator('input[type="file"]').setInputFiles(file);
    await row.getByRole("button", { name: /^(Ajouter|Remplacer)$/ }).click();
  };
  const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await upload("Acte de naissance", { name: "faux.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ pas un pdf") });
  await expect(page.locator("main li").filter({ hasText: "Acte de naissance" }).getByRole("alert")).toContainText("Format non accepté");
  await upload("Photo d'identité", { name: "photo.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(page.locator("main li").filter({ hasText: "Photo d'identité" }).getByRole("link", { name: "Consulter" })).toBeVisible();
  await upload("Acte de naissance", { name: "acte.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  const birthCert = page.locator("main li").filter({ hasText: "Acte de naissance" }).getByRole("link", { name: "Consulter" });
  await expect(birthCert).toBeVisible();
  const docUrl = await birthCert.getAttribute("href");
  // Justificatifs obligatoires complets (la validation de la licence les exige) : certificat médical.
  await upload("Certificat médical", { name: "certificat.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await expect(page.locator("main li").filter({ hasText: "Certificat médical" }).getByRole("link", { name: "Consulter" })).toBeVisible();

  // ── Demande de licence : sous-classement refusé, catégorie d'âge acceptée
  await page.goto(playerUrl);
  const medical = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  await page.selectOption('select[name="category"]', "U13");
  await page.fill('input[name="medicalCheckDate"]', medical);
  await page.fill('input[name="feeAmount"]', "5000");
  await button(page, "Déposer la demande de licence").click();
  await expect(formAlert(page)).toContainText("Sous-classement");
  await expect(page.locator('input[name="feeAmount"]')).toHaveValue("5000");

  await page.selectOption('select[name="category"]', "U17");
  await button(page, "Déposer la demande de licence").click();
  await expect(page).toHaveURL(/\/admin\/licences\/\d+$/);
  const licenseUrl = page.url();
  const licenseNumber = (await page.locator("main").textContent())?.match(/LIC-\d{4}-\d{6}/)?.[0];
  expect(licenseNumber).toBeTruthy();
  await expect(button(page, "Enregistrer l'encaissement")).toHaveCount(0); // un club ne valide pas

  // ── Le club paie les droits par Mobile Money (EF-LIC-11, simulation)
  await page.fill('input[name="phone"]', "04 123 45 67");
  await page.getByRole("button", { name: /^Payer 5.000 FCFA$/ }).click();
  await expect(formAlert(page)).toContainText("Airtel Money (05) ou MTN MoMo (06)");
  await page.fill('input[name="phone"]', "06 123 45 67");
  await page.getByRole("button", { name: /^Payer 5.000 FCFA$/ }).click();
  await expect(page).toHaveURL(/\/paiement\/PAY-LIC-/);
  await expect(page.locator("main")).toContainText("MTN MoMo");
  await button(page, "Confirmer le paiement").click();
  await expect(page).toHaveURL(licenseUrl);
  await expect(page.locator("main")).toContainText("Droits encaissés");
  await expect(page.locator("main")).toContainText(/réf\. PAY-LIC-/);
  await expect(page.getByRole("button", { name: /^Payer 5.000 FCFA$/ })).toHaveCount(0);

  // ── Accord : la demande part au représentant légal
  await page.goto(playerUrl);
  await button(page, "Envoyer la demande d'accord").click();
  const linkInput = page.locator("main input[readonly]");
  await expect(linkInput).toBeVisible();
  const consentLink = await linkInput.inputValue();
  expect(consentLink).toContain("/accord/");
  // Le lien est parti par SMS au représentant légal (EF-ACC-06).
  const sms = await latestNotification("+242 06 000 00 00", "consent_request");
  expect(sms?.body).toContain(consentLink);
  await expect(formStatus(page)).toContainText("représentant légal");
  await logout(page);

  // ── Droits déjà encaissés par Mobile Money : la validation reste bloquée sans accord
  await login(page, admin());
  await page.goto(licenseUrl);
  await expect(page.locator("main")).toContainText("Droits encaissés");
  await expect(button(page, "Enregistrer l'encaissement")).toHaveCount(0);
  await page.check('input[name="identityChecked"]');
  await button(page, "Valider la licence").click();
  await expect(formAlert(page)).toContainText("accord");

  // Une licence non validée n'est pas visible publiquement.
  await page.goto(`/verifier?numero=${licenseNumber}`);
  await expect(page.getByText("Aucune licence trouvée")).toBeVisible();

  // ── Le représentant légal répond, dans un navigateur sans session
  const guardian = await (await browser.newContext()).newPage();
  // Une pièce n'est pas accessible sans session : redirection vers la connexion, aucun contenu servi.
  const anonymous = await guardian.request.get(docUrl!, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()["location"]).toContain("/connexion");
  expect(anonymous.headers()["content-type"] ?? "").not.toContain("pdf");
  await guardian.goto(consentLink);
  await guardian.fill('input[name="birthDate"]', "2011-03-16");
  for (const box of ["playForClub", "dataProcessing", "legalGuardian"]) await guardian.check(`input[name="${box}"]`);
  await guardian.getByRole("button", { name: "Je donne mon accord" }).click();
  await expect(guardian.locator('main [role="alert"]')).toContainText("4 essai");
  await guardian.fill('input[name="birthDate"]', birthDate);
  await guardian.getByRole("button", { name: "Je donne mon accord" }).click();
  await expect(guardian.getByText("Votre accord a été enregistré")).toBeVisible();
  await guardian.goto(consentLink);
  await expect(guardian.getByText("déjà répondu")).toBeVisible();

  // ── Validation, carte de licence, vérification publique
  await page.goto(licenseUrl);
  // L'agent confirme avoir contrôlé l'identité sur pièces : tracé, puis affiché sur la carte.
  await page.check('input[name="identityChecked"]');
  await button(page, "Valider la licence").click();
  // Le statut change et le lien vers la carte apparaît.
  await expect(page.locator("main p").filter({ hasText: /^Validée$/ })).toBeVisible();
  await page.getByRole("link", { name: "Carte de licence" }).click();
  const card = page.getByRole("article", { name: "Carte de licence — recto" });
  await expect(card).toContainText(lastName.toUpperCase());
  await expect(card).toContainText("Identité vérifiée");
  await expect(card).toContainText("Active");
  await expect(card.getByRole("img", { name: /Photo de/ })).toBeVisible();
  // Verso : le QR code de vérification et les dates de validité.
  const back = page.getByRole("article", { name: "Carte de licence — verso" });
  await expect(back).toContainText("Expire le");
  await expect(back.locator("svg path").first()).toBeAttached();
  // PDF : recto et verso au format de la carte.
  const pdf = await page.request.get(page.url().replace(/\/carte$/, "/carte/pdf"));
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const box = await card.boundingBox();
  expect(Math.abs(box!.width / box!.height - 85.6 / 54)).toBeLessThan(0.05);

  await guardian.goto(`/verifier?numero=${licenseNumber!.toLowerCase()}`);
  await expect(guardian.getByText("Licence valide")).toBeVisible();
  await expect(guardian.locator("main")).not.toContainText("2011");

  // Avis de validation envoyé au représentant légal (EF-NOT-01).
  expect((await latestNotification("+242 06 000 00 00", "license_validated"))?.body).toContain(licenseNumber!);

  // Suspension puis révocation : signalées à la vérification publique ; plus aucune décision ensuite.
  await page.goto(licenseUrl);
  // Deux décisions avec motif sont proposées : chaque motif est saisi dans le formulaire de son bouton.
  const reasonFor = (label: string) => page.locator("form").filter({ has: button(page, label) }).locator('input[name="reason"]');
  await reasonFor("Suspendre").fill("Enquête en cours.");
  await button(page, "Suspendre").click();
  await expect(page.locator("main")).toContainText("Suspendue");
  await guardian.goto(`/verifier?numero=${licenseNumber}`);
  await expect(guardian.getByText("Licence suspendue")).toBeVisible();
  await reasonFor("Révoquer définitivement").fill("Fraude documentaire.");
  await button(page, "Révoquer définitivement").click();
  await expect(page.locator("main")).toContainText("Révoquée");
  await expect(button(page, "Réactiver")).toHaveCount(0);
  await guardian.goto(`/verifier?numero=${licenseNumber}`);
  await expect(guardian.getByText("Licence révoquée")).toBeVisible();

  await page.goto("/admin/licences");
  await expectNoHorizontalScroll(page);
});
