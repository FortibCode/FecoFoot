import { expect, test } from "./fixtures";
import { withDb } from "./db";
import { admin, button, formAlert, formStatus, login, RUN } from "./helpers";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Paramètres du portail : informations de la fédération et réseaux sociaux, saisis dans l'administration. */
test("paramètres du site : page « La Fédération » et réseaux sociaux du pied de page", async ({ page, browser }) => {
  const [before] = await withDb((sql) => sql`select * from site_settings where id = 1`);
  const visitor = await (await browser.newContext()).newPage();
  const affiliations = `FIFA · CAF · UNIFFAC · E2E ${RUN}`;
  const facebook = `https://www.facebook.com/e2e${RUN}`;
  await login(page, admin());
  try {
    await page.goto("/admin/parametres");
    await page.fill('input[name="affiliations"]', affiliations);
    // Un lien qui ne mène pas au réseau annoncé est refusé.
    await page.fill('input[name="facebook"]', "https://www.instagram.com/fecofoot_rc");
    await button(page, "Enregistrer les paramètres").click();
    await expect(formAlert(page)).toContainText("Corrigez");
    await expect(page.locator("main")).toContainText("Ce n'est pas une adresse Facebook.");
    await page.fill('input[name="facebook"]', facebook);
    await button(page, "Enregistrer les paramètres").click();
    await expect(formStatus(page)).toContainText("Paramètres enregistrés");

    await visitor.goto("/federation");
    await expect(visitor.locator("main")).toContainText(affiliations);
    await expect(visitor.getByRole("link", { name: "FECOFOOT sur Facebook" })).toHaveAttribute("href", facebook);
  } finally {
    // Valeurs d'origine remises en place.
    if (before) {
      await withDb(
        (sql) => sql`update site_settings set affiliations = ${before.affiliations}, facebook_url = ${before.facebook_url}, updated_by = ${before.updated_by}, updated_at = ${before.updated_at} where id = 1`,
      );
    }
  }
});

/** Sélection : sous-titre modifiable, portrait et crédit d'un convoqué de l'étranger, visibles une fois la liste publiée. */
test("sélection : sous-titre des cartes, portrait d'un convoqué hors registre", async ({ page, browser }) => {
  const [team] = await withDb((sql) => sql<{ id: number; tagline: string | null }[]>`select id, tagline from national_teams where slug = 'dames'`);
  const visitor = await (await browser.newContext()).newPage();
  const tagline = `Équipe féminine E2E ${RUN}`;
  const title = `E2E Portraits ${RUN}`;
  const credit = `E2E Auteur ${RUN} · CC0`;
  await login(page, admin());
  try {
    await page.goto("/admin/selections");
    await page.getByRole("link", { name: "Diables Rouges Dames" }).click();
    await page.fill('input[name="tagline"]', tagline);
    await button(page, "Enregistrer la présentation").click();
    await expect(page.locator("main")).toContainText("Présentation enregistrée.");
    await visitor.goto("/equipes-nationales");
    await expect(visitor.locator("main")).toContainText(tagline);

    // Liste avec un joueur de l'étranger, puis son portrait (crédit obligatoire).
    await page.fill('input[name="title"]', title);
    await button(page, "Créer la liste").click();
    await expect(page).toHaveURL(/\/admin\/selections\/convocation\/\d+$/);
    await page.getByLabel("Joueur évoluant à l'étranger").check();
    await page.fill('input[name="externalName"]', `E2E Joueuse ${RUN}`);
    await page.fill('input[name="externalClub"]', "Paris FC");
    await page.fill('input[name="externalCountry"]', "France");
    await button(page, "Ajouter à la liste").click();
    const row = page.locator("li").filter({ hasText: `E2E Joueuse ${RUN}` });
    await row.getByText("Ajouter un portrait").click();
    await row.locator('input[name="photo"]').setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: PNG_1PX });
    await row.locator('input[name="credit"]').fill(credit);
    await row.getByRole("button", { name: "Ajouter le portrait" }).click();
    await expect(row).toContainText(`Photo : ${credit}`);
    const src = (await row.locator("img").first().getAttribute("src"))!;
    // Liste non publiée : portrait servi à l'administration seulement.
    expect((await page.request.get(src)).status()).toBe(200);
    expect((await visitor.request.get(src)).status()).toBe(404);

    // Publiée : portrait et crédit sur la fiche de la sélection.
    await page.getByRole("button", { name: "Publier sur le portail" }).click();
    await expect(page.getByRole("button", { name: "Retirer du portail" })).toBeVisible();
    await visitor.goto("/equipes-nationales/dames#effectif");
    await expect(visitor.getByRole("tabpanel", { name: "Effectif" })).toContainText(`Photo : ${credit}`);
    expect((await visitor.request.get(src)).status()).toBe(200);

    // Photo retirée : plus de portrait, le fichier n'est plus servi.
    await row.getByRole("button", { name: "Retirer la photo" }).click();
    await expect(row).not.toContainText(`Photo : ${credit}`);
    expect((await visitor.request.get(src)).status()).toBe(404);
  } finally {
    await withDb(async (sql) => {
      await sql`delete from selections where title = ${title}`;
      await sql`update national_teams set tagline = ${team.tagline} where id = ${team.id}`;
    });
  }
});
