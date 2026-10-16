import { expect, test } from "@playwright/test";
import { extractLink, latestNotification } from "./db";
import { admin, button, createUser, e2eEmail, formAlert, formStatus, login, logout } from "./helpers";

/** Mot de passe oublié, réinitialisation, changement par l'utilisateur (EF-AUT-04). */
test("mot de passe : oubli, lien à usage unique, changement et fermeture des autres sessions", async ({ page, browser }) => {
  await login(page, admin());
  const user = await createUser(page, { fullName: "Compte Mdp E2E", email: e2eEmail("mdp"), role: "COMMUNICATION" });
  await logout(page);

  // Adresse inconnue : même réponse (on ne révèle pas quels comptes existent).
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
  await page.fill('input[name="email"]', "inconnu@e2e.example.cg");
  await button(page, "Recevoir un lien de réinitialisation").click();
  const neutral = await formStatus(page).textContent();

  await page.goto("/mot-de-passe-oublie");
  await page.fill('input[name="email"]', user.email);
  await button(page, "Recevoir un lien de réinitialisation").click();
  await expect(formStatus(page)).toHaveText(neutral!);

  const mail = await latestNotification(user.email, "password_reset");
  expect(mail?.channel).toBe("EMAIL");
  const link = extractLink(mail!.body)!;
  expect(link).toContain("/reinitialiser/");

  // Choix du nouveau mot de passe
  const newPassword = "NouveauMdp2026e2e";
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Choisir un nouveau mot de passe" })).toBeVisible();
  await page.fill('input[name="password"]', newPassword);
  await page.fill('input[name="confirm"]', "autre-chose-2026");
  await button(page, "Enregistrer le mot de passe").click();
  await expect(formAlert(page)).toContainText("ne correspondent pas");
  await page.fill('input[name="password"]', newPassword);
  await page.fill('input[name="confirm"]', newPassword);
  await button(page, "Enregistrer le mot de passe").click();
  await expect(formStatus(page)).toContainText("a été modifié");

  // Le lien ne sert qu'une fois.
  await page.goto(link);
  await page.fill('input[name="password"]', "EncoreUnAutre2026x");
  await page.fill('input[name="confirm"]', "EncoreUnAutre2026x");
  await button(page, "Enregistrer le mot de passe").click();
  await expect(formAlert(page)).toContainText("n'est plus valable");

  // L'ancien mot de passe ne fonctionne plus, le nouveau oui.
  await page.goto("/connexion");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await button(page, "Se connecter").click();
  await expect(formAlert(page)).toContainText("incorrect");
  await login(page, { email: user.email, password: newPassword });

  // Une seconde session (autre appareil) est fermée quand l'utilisateur change son mot de passe.
  const other = await (await browser.newContext()).newPage();
  await login(other, { email: user.email, password: newPassword });

  await page.goto("/admin/mon-compte");
  await page.fill('input[name="current"]', "mauvais-actuel-2026");
  await page.fill('input[name="password"]', "TroisiemeMdp2026e2e");
  await page.fill('input[name="confirm"]', "TroisiemeMdp2026e2e");
  await button(page, "Changer le mot de passe").click();
  await expect(formAlert(page)).toContainText("actuel incorrect");
  await page.fill('input[name="current"]', newPassword);
  await page.fill('input[name="password"]', "TroisiemeMdp2026e2e");
  await page.fill('input[name="confirm"]', "TroisiemeMdp2026e2e");
  await button(page, "Changer le mot de passe").click();
  await expect(formStatus(page)).toContainText("autres sessions ont été fermées");

  // La session courante reste ouverte, l'autre est renvoyée vers la connexion.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await other.goto("/admin");
  await expect(other).toHaveURL(/\/connexion$/);
});
