import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { seedLicensedPlayers } from "./db";
import { admin, button, createClub, createUser, e2eEmail, login, logout, RUN } from "./helpers";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Actualités (M14) et portail public (M01) : publication, rubriques, page d'accueil, fiches clubs, référencement. */
test("portail : actualité publiée, page d'accueil, fiche club, référencement", async ({ page, browser }) => {
  const title = `E2E Liste des convoqués ${RUN}`;
  const clubName = `E2E Club Portail ${RUN}`;
  const visitor = await (await browser.newContext()).newPage();

  // Club affilié avec deux joueurs licenciés
  await login(page, admin());
  await createClub(page, clubName, { affiliate: true });
  await seedLicensedPlayers(clubName, 2, seasonOf(), `${RUN}P`);
  const com = await createUser(page, { fullName: "Communication Portail E2E", email: e2eEmail("com-portail"), role: "COMMUNICATION" });
  await logout(page);

  // Rédaction (EF-COM-01, EF-COM-02)
  await login(page, com);
  await page.goto("/admin/actualites/nouveau");
  await page.fill('input[name="title"]', title);
  await page.selectOption('select[name="category"]', "NATIONAL_TEAMS");
  await page.fill('textarea[name="summary"]', "La Direction technique nationale publie la liste des joueurs retenus.");
  await page.fill(
    'textarea[name="body"]',
    "## Les gardiens\n\nLa **DTN** a retenu *trois* gardiens.\n\n- Gardien un\n- Gardien deux\n\n<script>window.__pwned = true</script> Voir [le calendrier](https://fecofoot.cg/equipes-nationales).",
  );
  await button(page, "Créer le brouillon").click();
  await expect(page).toHaveURL(/\/admin\/actualites\/\d+$/);
  const adminUrl = page.url();
  await page.locator('input[type="file"]').setInputFiles({ name: "visuel.png", mimeType: "image/png", buffer: PNG_1PX });
  await button(page, "Ajouter").click();
  await expect(page.locator("main img").first()).toBeVisible();
  await expect(page.locator(".article-body h2")).toHaveText("Les gardiens"); // aperçu

  // Brouillon : invisible sur le portail
  await visitor.goto("/actualites");
  await expect(visitor.locator("main")).not.toContainText(title);

  await button(page, "Publier").click();
  await expect(page.locator("main")).toContainText("publié le");
  const publicHref = (await page.getByRole("link", { name: "Voir sur le portail" }).getAttribute("href"))!;

  // Liste, filtre par rubrique, page article (EF-PUB-02)
  await visitor.goto("/actualites?rubrique=equipes-nationales");
  await expect(visitor.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await visitor.goto("/actualites?rubrique=arbitrage");
  await expect(visitor.locator("main")).not.toContainText(title);
  await visitor.goto(publicHref);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(visitor.locator(".article-body h2")).toHaveText("Les gardiens");
  await expect(visitor.locator(".article-body strong")).toHaveText("DTN");
  await expect(visitor.locator(".article-body li")).toHaveCount(2);
  await expect(visitor.locator(".article-body")).toContainText("<script>"); // affiché comme texte, jamais exécuté
  expect(await visitor.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
  const coverSrc = (await visitor.locator("main article img").getAttribute("src"))!;
  const cover = await visitor.request.get(coverSrc);
  expect(cover.status()).toBe(200);
  expect(cover.headers()["content-type"]).toBe("image/png");
  // Référencement et partage (EF-PUB-08)
  await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
  await expect(visitor.locator('meta[name="description"]')).toHaveAttribute("content", /Direction technique/);

  // Page d'accueil (EF-PUB-01)
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(/Suivre les compétitions\s*Soutenir les Diables Rouges\s*Vivre le football congolais/);
  await expect(visitor.getByRole("list", { name: "Chiffres clés" })).toContainText("Clubs affiliés");
  await expect(visitor.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Espace fédéral" })).toBeVisible();

  // Clubs par ville, fiche club : effectif limité au nom et au poste (EF-PUB-04)
  await visitor.goto("/clubs");
  await visitor.getByRole("link", { name: new RegExp(clubName) }).click();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(clubName);
  await expect(visitor.locator("main")).toContainText(`E2E${RUN}PAA`.toUpperCase());
  await expect(visitor.locator("main")).not.toContainText("1998"); // pas de date de naissance

  // Plan du site et robots.txt
  const sitemap = await (await visitor.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(publicHref);
  expect(await (await visitor.request.get("/robots.txt")).text()).toContain("Disallow: /admin");

  // Dépublication : l'article et son visuel disparaissent du portail.
  await page.goto(adminUrl);
  await button(page, "Retirer du portail").click();
  await expect(page.locator("main")).toContainText("brouillon");
  expect((await visitor.request.get(publicHref)).status()).toBe(404);
  expect((await visitor.request.get(coverSrc)).status()).toBe(404);
});
