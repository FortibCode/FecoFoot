import { expect, type Page } from "@playwright/test";

/** Jeu de données propre à chaque exécution : préfixe « E2E » et suffixe unique. */
export const RUN = Date.now().toString(36).slice(-6);
export const E2E_EMAIL_DOMAIN = "e2e.example.cg";
export const e2eEmail = (who: string) => `${who}.${RUN}@${E2E_EMAIL_DOMAIN}`;
export const E2E_PASSWORD = "E2eTest2026xyz";

export const admin = () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD doivent être définis dans .env");
  return { email, password };
};

export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Message d'erreur ou de succès d'un formulaire (la zone role=alert de Next est hors de <main>). */
export const formAlert = (page: Page) => page.locator('main [role="alert"]');
export const formStatus = (page: Page) => page.locator('main [role="status"]');

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto("/connexion");
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await button(page, "Se connecter").click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function logout(page: Page) {
  await button(page, "Déconnexion").click();
  await expect(page).toHaveURL(/\/connexion$/);
}

export async function expectNoHorizontalScroll(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, "la page ne doit pas défiler horizontalement sur téléphone").toBe(true);
}

/** Crée un club (en tant qu'admin connecté) et renvoie son URL et son numéro d'affiliation. */
export async function createClub(page: Page, name: string, opts: { affiliate?: boolean; shortName?: string } = {}) {
  await page.goto("/admin/clubs/nouveau");
  await page.fill('input[name="name"]', name);
  if (opts.shortName) await page.fill('input[name="shortName"]', opts.shortName);
  await page.selectOption('select[name="leagueId"]', { label: "Ligue de Brazzaville" });
  await page.fill('input[name="city"]', "Brazzaville");
  await button(page, "Créer le club").click();
  await expect(page).toHaveURL(/\/admin\/clubs\/\d+$/);
  const affiliation = (await page.locator("main").textContent())?.match(/FCF-CLB-\d{4,}/)?.[0];
  if (opts.affiliate) {
    await page.selectOption('select[name="status"]', "AFFILIATED");
    await button(page, "Appliquer").click();
    await expect(formStatus(page)).toContainText("Statut d'affiliation mis à jour");
  }
  return { url: page.url(), affiliation };
}

/** Crée un compte interne (en tant qu'admin connecté). */
export async function createUser(
  page: Page,
  u: { fullName: string; email: string; role: string; league?: string; club?: string },
) {
  await page.goto("/admin/utilisateurs/nouveau");
  await page.fill('input[name="fullName"]', u.fullName);
  await page.fill('input[name="email"]', u.email);
  await page.selectOption('select[name="role"]', u.role);
  if (u.league) await page.selectOption('select[name="leagueId"]', { label: u.league });
  if (u.club) await page.selectOption('select[name="clubId"]', { label: u.club });
  await page.fill('input[name="password"]', E2E_PASSWORD);
  await button(page, "Créer le compte").click();
  await expect(page).toHaveURL(/\/admin\/utilisateurs\/\d+$/);
  return { email: u.email, password: E2E_PASSWORD };
}
