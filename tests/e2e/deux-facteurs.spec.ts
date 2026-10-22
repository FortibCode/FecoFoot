import { expect, test } from "./fixtures";
import { totp } from "../../lib/auth/totp";
import { admin, button, createUser, e2eEmail, formAlert, formStatus, login, logout } from "./helpers";

/** Double authentification par application (EF-AUT-05). */
test("double authentification : activation, connexion avec code, réinitialisation par l'administrateur", async ({ page }) => {
  await login(page, admin());
  const user = await createUser(page, { fullName: "Billetterie 2FA E2E", email: e2eEmail("2fa"), role: "TICKETING" });
  const userUrl = page.url();
  await logout(page);

  // Activation
  await login(page, user);
  await page.goto("/admin/mon-compte");
  await page.getByRole("link", { name: /activer la double authentification/i }).click();
  await button(page, "Commencer l'activation").click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await expect(page.locator("main svg")).toBeVisible(); // QR code à scanner
  await page.fill('input[name="code"]', "000000");
  await button(page, "Activer").click();
  await expect(formAlert(page)).toContainText("Code incorrect");
  await page.fill('input[name="code"]', totp(secret));
  await button(page, "Activer").click();
  await expect(page.locator("main")).toContainText("Activée depuis");
  await logout(page);

  // Connexion : mot de passe puis code
  await page.goto("/connexion");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await button(page, "Se connecter").click();
  await expect(page).toHaveURL(/\/connexion\/verification$/);
  // Sans code, pas d'accès à l'espace fédéral.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion$/);

  await page.goto("/connexion");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await button(page, "Se connecter").click();
  await expect(page).toHaveURL(/\/connexion\/verification$/);
  await page.fill('input[name="code"]', "123456");
  await button(page, "Valider").click();
  await expect(formAlert(page)).toContainText("Code incorrect");
  // Le code de l'activation a déjà servi : on utilise celui du pas suivant (toléré à ±30 s).
  await page.fill('input[name="code"]', totp(secret, new Date(Date.now() + 30_000)));
  await button(page, "Valider").click();
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page);

  // Perte du téléphone : le super administrateur réinitialise.
  await login(page, admin());
  await page.goto(userUrl);
  await expect(page.locator("main")).toContainText("double authentification : activée");
  await button(page, "Réinitialiser la double authentification").click();
  await expect(page.locator("main")).toContainText("double authentification : non activée");
  await logout(page);
  await login(page, user); // connexion directe, sans code
  await expect(formStatus(page)).toHaveCount(0);
});
