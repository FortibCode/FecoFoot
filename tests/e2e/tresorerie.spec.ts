import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { withDb } from "./db";
import { admin, button, createUser, e2eEmail, login, logout, RUN } from "./helpers";

/** Paiements (M16) et exports (M19) côté administrateur. */
test("trésorerie : synthèse, filtres, expiration des paiements en attente, exports", async ({ page }) => {
  const tag = RUN.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(-8);
  const ok = `PAY-MBR-E2E${tag}A`;
  const stale = `PAY-MBR-E2E${tag}B`;
  await withDb(async (sql) => {
    await sql`insert into payments (reference, purpose, target_id, method, phone, amount, status, confirmed_at)
              values (${ok}, 'MEMBERSHIP', 0, 'AIRTEL_MONEY', '+242050000001', 12500, 'SUCCEEDED', now())`;
    await sql`insert into payments (reference, purpose, target_id, method, phone, amount, status, created_at)
              values (${stale}, 'MEMBERSHIP', 0, 'MTN_MOMO', '+242060000001', 7000, 'PENDING', now() - interval '1 hour')`;
  });

  // Le service billetterie a accès à la trésorerie.
  await login(page, admin());
  const agent = await createUser(page, { fullName: "Trésorerie E2E", email: e2eEmail("tresorerie"), role: "TICKETING" });
  await logout(page);
  await login(page, agent);
  await page.goto("/admin/paiements");
  await expect(page.getByRole("heading", { name: "Paiements", exact: true })).toBeVisible();

  // Recherche par référence : une seule ligne, montant et état.
  await page.goto(`/admin/paiements?q=${ok}`);
  const rows = page.getByTestId("payment-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("12 500");
  await expect(rows.first()).toContainText("Payé");

  // Le paiement resté en attente depuis une heure passe à « expiré ».
  await page.goto(`/admin/paiements?q=${stale}`);
  await expect(page.getByTestId("payment-row").first()).toContainText("En attente");
  await button(page, "Expirer les paiements en attente depuis plus de 15 minutes").click();
  // Plus aucun paiement en attente : le bloc d'expiration disparaît avec son message ; l'état fait foi.
  await expect(button(page, "Expirer les paiements en attente depuis plus de 15 minutes")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("payment-row").first()).toContainText("Expiré");

  // Export Excel avec les filtres.
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter (Excel)" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^paiements-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect((await readFile((await file.path())!)).subarray(0, 2).toString()).toBe("PK");

  // Page des exports : la billetterie n'y voit que les paiements.
  await page.goto("/admin/exports");
  await expect(page.getByRole("heading", { name: "Paiements", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Licences d'un club" })).toHaveCount(0);
  await logout(page);

  // L'administrateur voit tous les exports.
  await login(page, admin());
  await page.goto("/admin/exports");
  for (const h of ["Licences d'un club", "Classements", "Convocations des sélections", "Paiements", "Journal d'audit"]) {
    await expect(page.getByRole("heading", { name: h, level: 2 })).toBeVisible();
  }
});
