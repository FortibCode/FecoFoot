import { expect, test } from "./fixtures";
import { admin, button, login, RUN } from "./helpers";

/** Instances et commissions : création, membres, fin de mandat, page publique « La Fédération ». */
test("instances : commission, membres, mandat clos et page publique", async ({ page, browser }) => {
  const name = `E2E Commission ${RUN}`;
  await login(page, admin());
  await page.goto("/admin/instances");
  await page.fill('input[name="name"]', name);
  await page.selectOption('select[name="kind"]', "PERMANENT");
  await button(page, "Créer l'instance").click();
  await expect(page).toHaveURL(/\/admin\/instances\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  // Membres : l'ordre suit la fonction (président d'abord), quel que soit l'ordre de saisie.
  for (const [fullName, position] of [
    ["E2EMEMBRE Paul", "Membre"],
    ["E2EPRESIDENT Jean", "Président"],
  ]) {
    await page.fill('input[name="fullName"]', fullName);
    await page.fill('input[name="position"]', position);
    await page.fill('input[name="startDate"]', "2026-10-28");
    await button(page, "Ajouter le membre").click();
    await expect(page.locator("main table").first()).toContainText(fullName);
  }
  await expect(page.locator("main table").first().locator("tbody tr").first()).toContainText("E2EPRESIDENT Jean");

  // Page publique : la commission et ses membres.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/federation");
  const section = visitor.getByRole("region", { name });
  await expect(section).toContainText("E2EPRESIDENT Jean");
  await expect(section).toContainText("E2EMEMBRE Paul");

  // Fin de mandat : le membre passe dans l'historique et quitte la page publique.
  const row = page.locator("main table").first().locator("tr").filter({ hasText: "E2EMEMBRE Paul" });
  await row.locator('input[name="endDate"]').fill("2026-12-31");
  await row.getByRole("button", { name: "Clore le mandat" }).click();
  await expect(page.getByRole("heading", { name: "Historique des mandats" })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("region", { name })).not.toContainText("E2EMEMBRE Paul");
});
