import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { withDb } from "./db";
import { admin, button, createUser, e2eEmail, formAlert, login, logout, RUN } from "./helpers";

/** Fan ID et club des supporters (M11), paiement Mobile Money simulé (M16), interdiction de stade (EF-SUP-07). */
test("supporter : Fan ID, adhésion payée par Mobile Money, interdiction de stade", async ({ page, browser }) => {
  const season = seasonOf();
  const digits = String(Date.now()).slice(-7);
  const phone = `06 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  const password = "Supporter2026";
  const lastName = `E2E${RUN.replace(/[^a-z]/g, "")}`.toUpperCase();

  // Tarifs d'adhésion : on note ceux de la saison pour les remettre à la fin.
  const previous = await withDb((sql) => sql<{ tier: string; price: number; open: boolean }[]>`select tier, price, open from membership_plans where season = ${season}`);
  await login(page, admin());
  const ticketing = await createUser(page, { fullName: "Billetterie E2E", email: e2eEmail("billet"), role: "TICKETING" });
  await logout(page);
  await login(page, ticketing);
  await page.goto("/admin/supporters/adhesions");
  await page.getByLabel("Prix Adulte").fill("5000");
  await page.locator("form").filter({ has: page.getByLabel("Prix Adulte") }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("form").filter({ has: page.getByLabel("Prix Adulte") }).getByRole("status")).toBeVisible();
  await page.getByLabel("Prix Jeune").fill("2000");
  await page.locator("form").filter({ has: page.getByLabel("Prix Jeune") }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("form").filter({ has: page.getByLabel("Prix Jeune") }).getByRole("status")).toBeVisible();

  // Création du Fan ID (navigateur du supporter)
  const fan = await (await browser.newContext()).newPage();
  await fan.goto("/supporters");
  await fan.getByRole("link", { name: "Créer mon Fan ID" }).click();
  await expect(fan).toHaveURL(/\/supporters\/inscription$/);
  await fan.fill('input[name="lastName"]', lastName);
  await fan.fill('input[name="firstName"]', "Supporter");
  await fan.fill('input[name="birthDate"]', "1990-05-12");
  await fan.fill('input[name="phone"]', "07 123 45 67");
  await fan.fill('input[name="idDocumentNumber"]', `E2E${digits}`);
  await fan.fill('input[name="password"]', password);
  await fan.check('input[name="consent"]');
  await button(fan, "Créer mon Fan ID").click();
  await expect(fan.locator("main")).toContainText("Numéro congolais invalide");
  await fan.fill('input[name="phone"]', phone);
  await button(fan, "Créer mon Fan ID").click();
  await expect(fan).toHaveURL(/\/supporters\/espace$/);
  const card = fan.getByRole("article", { name: "Carte Fan ID" });
  const fanId = (await card.textContent())!.match(/FAN-\d{6}/)![0];
  await expect(card).toContainText("Non membre");
  await expect(fan.getByTestId("fan-points")).toHaveText("0");

  // Même numéro : refusé.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/supporters/inscription");
  await other.fill('input[name="lastName"]', lastName);
  await other.fill('input[name="firstName"]', "Doublon");
  await other.fill('input[name="birthDate"]', "1991-01-01");
  await other.fill('input[name="phone"]', `+242${phone.replace(/\s/g, "")}`);
  await other.fill('input[name="idDocumentNumber"]', `E2EX${digits}`);
  await other.fill('input[name="password"]', password);
  await other.check('input[name="consent"]');
  await button(other, "Créer mon Fan ID").click();
  await expect(formAlert(other)).toContainText("existe déjà");

  // Adhésion : formule jeune indisponible pour un adulte ; paiement Mobile Money simulé.
  await fan.getByRole("link", { name: "Rejoindre le club des supporters" }).click();
  await expect(fan.locator('input[value="YOUTH"]')).toBeDisabled();
  await expect(fan.locator('select[name="method"]')).toHaveValue("MTN_MOMO"); // numéro en 06
  await button(fan, "Adhérer et payer").click();
  await expect(fan).toHaveURL(/\/paiement\/PAY-MBR-/);
  await expect(fan.locator("main")).toContainText(/5\s000\sFCFA/);
  await button(fan, "Confirmer le paiement").click();
  await expect(fan).toHaveURL(/\/supporters\/espace$/);
  await expect(card).toContainText("Membre");
  await expect(fan.getByTestId("fan-points")).toHaveText("1");

  // Reconnexion avec une autre écriture du numéro ; mauvais mot de passe refusé.
  await button(fan, "Se déconnecter").click();
  await fan.goto("/supporters/connexion");
  await fan.fill('input[name="phone"]', `00242${phone.replace(/\s/g, "")}`);
  await fan.fill('input[name="password"]', "mauvais-mdp-1");
  await button(fan, "Se connecter").click();
  await expect(formAlert(fan)).toContainText("incorrect");
  await fan.fill('input[name="password"]', password);
  await button(fan, "Se connecter").click();
  await expect(fan).toHaveURL(/\/supporters\/espace$/);

  // La billetterie prononce une interdiction de stade (RG-14) : la session du supporter est fermée.
  await page.goto(`/admin/supporters?q=${encodeURIComponent(phone)}`);
  await page.getByRole("link", { name: new RegExp(lastName) }).click();
  await expect(page.locator("main")).toContainText(fanId);
  await page.fill('input[name="reason"]', "Jet de projectiles, match du 12 octobre.");
  await button(page, "Prononcer une interdiction de stade").click();
  await expect(page.locator("main")).toContainText("Interdit depuis");

  await fan.reload();
  await expect(fan).toHaveURL(/\/supporters\/connexion$/);
  await fan.fill('input[name="phone"]', phone);
  await fan.fill('input[name="password"]', password);
  await button(fan, "Se connecter").click();
  await expect(fan.getByRole("alert").filter({ hasText: "interdiction de stade" })).toBeVisible();
  await fan.goto("/supporters/adhesion");
  await expect(fan).toHaveURL(/\/supporters\/espace$/);

  // Remise en état des tarifs.
  await withDb(async (sql) => {
    await sql`delete from membership_plans where season = ${season}`;
    for (const p of previous) await sql`insert into membership_plans (season, tier, price, open) values (${season}, ${p.tier}, ${p.price}, ${p.open})`;
  });
});
