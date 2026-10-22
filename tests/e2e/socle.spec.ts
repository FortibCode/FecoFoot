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
  // Tableau de bord : le menu des modules s'affiche, sur la rubrique « Tableau de bord ».
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "Modules" }).getByRole("link", { name: "Tableau de bord", exact: true })).toBeVisible();
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

test("ligues : listées par 5 et modifiables", async ({ page }) => {
  await login(page, admin());
  await page.goto("/admin/ligues");
  const leagues = page.getByTestId("league-row");
  // Pagination par 5 : la première page et le total des ligues.
  await expect(leagues).toHaveCount(5);
  await expect(page.getByTestId("table-pager")).toContainText(/1–5 sur \d+/);

  // Modification dans la fiche de la ligue.
  await leagues.first().getByRole("link", { name: /^Modifier / }).click();
  await expect(page).toHaveURL(/\/admin\/ligues\/\d+#modifier$/);
  const president = page.locator('input[name="president"]');
  const original = await president.inputValue();
  await president.fill(`Président E2E ${RUN}`);
  await button(page, "Enregistrer la ligue").click();
  await expect(formStatus(page)).toContainText("Ligue mise à jour");
  // Remise en état
  await president.fill(original);
  await button(page, "Enregistrer la ligue").click();
  await expect(formStatus(page)).toBeVisible();
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
  await expect(page.getByRole("link", { name: clubName, exact: true })).toBeVisible();

  const league = await createUser(page, {
    fullName: "Ligue BZV E2E",
    email: e2eEmail("ligue"),
    role: "LEAGUE",
    league: "Ligue départementale de Brazzaville",
  });
  await logout(page);

  await login(page, league);
  await expect(page.getByRole("navigation", { name: "Modules" })).not.toContainText("Utilisateurs");
  await page.goto("/admin/utilisateurs");
  await expect(page).toHaveURL(/\/admin\/acces-refuse$/);
  await page.goto(`/admin/clubs?q=${encodeURIComponent(clubName)}`);
  await expect(page.getByRole("link", { name: clubName, exact: true })).toBeVisible();
  await expect(page.locator('select[name="league"]')).toHaveCount(0);
  // Une ligue ne change pas le statut d'affiliation.
  await page.getByRole("link", { name: clubName, exact: true }).click();
  await expect(page.locator('select[name="status"]')).toHaveCount(0);
  await expect(formStatus(page)).toHaveCount(0);
});
