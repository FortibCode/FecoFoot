import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import {
  admin,
  button,
  createClub,
  createUser,
  e2eEmail,
  expectNoHorizontalScroll,
  formAlert,
  formStatus,
  login,
  logout,
  RUN,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("connexion : accès protégé, mauvais mot de passe refusé, connexion et journal", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion$/);

  await page.fill('input[name="email"]', admin().email);
  await page.fill('input[name="password"]', "mauvais-mot-de-passe-1");
  await button(page, "Se connecter").click();
  await expect(formAlert(page)).toContainText("incorrect");
  // La saisie est conservée après une erreur.
  await expect(page.locator('input[name="email"]')).toHaveValue(admin().email);

  await login(page, admin());
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto("/admin/journal?action=LOGIN_FAILED");
  await expect(page.locator("main tbody tr").first()).toContainText("LOGIN_FAILED");
  await expectNoHorizontalScroll(page);

  // Export Excel du journal filtré (EF-AUD-02), lui-même tracé.
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/admin/journal?action=LOGIN_FAILED&from=${today}&to=${today}`);
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter (Excel)" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^journal-audit-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK"); // classeur Excel (zip)
  await page.goto("/admin/journal?action=AUDIT_EXPORTED");
  await expect(page.locator("main tbody tr").first()).toContainText("LOGIN_FAILED");
});

test("ligues : les 12 ligues sont listées et modifiables", async ({ page }) => {
  await login(page, admin());
  await page.goto("/admin/ligues");
  const leagues = page.locator("main li");
  await expect(leagues).toHaveCount(12);

  const first = leagues.first();
  const president = first.locator('input[name="president"]');
  const original = await president.inputValue();
  await president.fill(`Président E2E ${RUN}`);
  await first.getByRole("button", { name: "Enregistrer" }).click();
  await expect(first.locator('[role="status"]')).toContainText("Ligue mise à jour");
  // Remise en état
  await president.fill(original);
  await first.getByRole("button", { name: "Enregistrer" }).click();
  await expect(first.locator('[role="status"]')).toBeVisible();
});

test("clubs et comptes : affiliation, dirigeants, périmètre d'une ligue", async ({ page }) => {
  const clubName = `E2E Club Socle ${RUN}`;
  await login(page, admin());
  const club = await createClub(page, clubName, { affiliate: true });
  expect(club.affiliation).toMatch(/^FCF-CLB-\d{4,}$/);

  await page.locator('input[name="fullName"]').last().fill("Jean Dirigeant E2E");
  await page.locator('input[name="position"]').fill("Président");
  await button(page, "Ajouter le dirigeant").click();
  await expect(page.getByText("Jean Dirigeant E2E")).toBeVisible();
  // Le formulaire d'ajout est vidé après succès.
  await expect(page.locator('input[name="position"]')).toHaveValue("");

  await page.goto(`/admin/clubs?q=${encodeURIComponent(clubName)}`);
  await expect(page.getByRole("link", { name: clubName })).toBeVisible();

  const league = await createUser(page, {
    fullName: "Ligue BZV E2E",
    email: e2eEmail("ligue"),
    role: "LEAGUE",
    league: "Ligue de Brazzaville",
  });
  await logout(page);

  await login(page, league);
  await expect(page.getByRole("navigation", { name: "Modules" })).not.toContainText("Utilisateurs");
  await page.goto("/admin/utilisateurs");
  await expect(page).toHaveURL(/\/admin\/acces-refuse$/);
  await page.goto(`/admin/clubs?q=${encodeURIComponent(clubName)}`);
  await expect(page.getByRole("link", { name: clubName })).toBeVisible();
  await expect(page.locator('select[name="league"]')).toHaveCount(0);
  // Une ligue ne change pas le statut d'affiliation.
  await page.getByRole("link", { name: clubName }).click();
  await expect(page.locator('select[name="status"]')).toHaveCount(0);
  await expect(formStatus(page)).toHaveCount(0);
});
