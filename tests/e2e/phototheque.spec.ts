import { expect, test } from "./fixtures";
import { withDb } from "./db";
import { admin, button, createUser, e2eEmail, login, logout, RUN } from "./helpers";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Photothèque (M14) : ajout en lot, sélection, mise à la une, masquage, suppression. */
test("photothèque : photos d'une sélection, à la une sur l'accueil, masquées puis supprimées", async ({ page, browser }) => {
  const caption = `E2E Photo ${RUN}`;
  // Les photos à la une actuelles sont remises en place à la fin.
  const previous = (await withDb((sql) => sql<{ id: number }[]>`select id from photos where featured`)).map((r) => r.id);
  const visitor = await (await browser.newContext()).newPage();

  await login(page, admin());
  const com = await createUser(page, { fullName: "Communication Photos E2E", email: e2eEmail("com-photos"), role: "COMMUNICATION" });
  await logout(page);
  await login(page, com);

  try {
    // Ajout de deux fichiers : l'image valide passe, le faux PNG est refusé avec son nom.
    await page.goto("/admin/photos");
    await page.locator('input[name="files"]').setInputFiles([
      { name: "entrainement.png", mimeType: "image/png", buffer: PNG_1PX },
      { name: "texte.png", mimeType: "image/png", buffer: Buffer.from("pas une image") },
    ]);
    await page.locator("form").filter({ has: page.locator('input[name="files"]') }).locator('select[name="teamId"]').selectOption({ label: "Diables Rouges U-17" });
    await page.fill('input[name="caption"]', caption);
    await button(page, "Ajouter les photos").click();
    await expect(page.locator('main [role="alert"]')).toContainText("texte.png");

    await page.goto("/admin/photos?equipe=u17");
    const card = page.getByTestId("photo-card").filter({ has: page.locator(`input[name="caption"][value="${caption}"]`) });
    await expect(card).toHaveCount(1);
    const src = (await card.locator('a[href^="/media/photos/"]').getAttribute("href"))!;

    // Publiée : visible sur la page de la sélection, servie sans session.
    await visitor.goto("/equipes-nationales/u17");
    await expect(visitor.getByRole("img", { name: caption })).toBeVisible();
    const media = await visitor.request.get(src);
    expect(media.status()).toBe(200);
    expect(media.headers()["content-type"]).toBe("image/png");

    // À la une : bandeau de la page d'accueil.
    await card.getByRole("button", { name: "Mettre à la une" }).click();
    await expect(card).toContainText("À la une");
    await visitor.goto("/");
    await expect(visitor.locator(`main img[src="${src}"]`).first()).toBeAttached();

    // Masquée : retirée du portail et plus servie publiquement.
    await card.getByRole("button", { name: "Masquer" }).click();
    await expect(card).toContainText("Masquée");
    await expect(card).not.toContainText("À la une");
    await visitor.goto("/equipes-nationales/u17");
    await expect(visitor.getByRole("img", { name: caption })).toHaveCount(0);
    expect((await visitor.request.get(src)).status()).toBe(404);

    // Suppression, après confirmation.
    page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "Supprimer" }).click();
    await expect(card).toHaveCount(0);
  } finally {
    await withDb((sql) => sql`update photos set featured = (id = any(${previous}::int[]))`);
  }
});
