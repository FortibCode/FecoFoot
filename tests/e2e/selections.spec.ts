import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { seedLicensedPlayers, withDb } from "./db";
import { admin, button, createClub, createUser, e2eEmail, formAlert, formStatus, login, logout, RUN } from "./helpers";

/** Équipes nationales (M09) : staff, convocations (registre + étranger), publication, lettres aux clubs. */
test("sélection nationale : convocation, publication sur le portail et lettres aux clubs", async ({ page, browser }) => {
  const clubName = `E2E Club Sélection ${RUN}`;
  await login(page, admin());
  await createClub(page, clubName, { affiliate: true });
  const dtn = await createUser(page, { fullName: "DTN E2E", email: e2eEmail("dtn"), role: "DTN" });
  const { playerIds } = await seedLicensedPlayers(clubName, 1, seasonOf(), `${RUN}S`);
  const federalId = await withDb(async (sql) => (await sql<{ federal_id: string }[]>`select federal_id from players where id = ${playerIds[0]}`)[0].federal_id);
  await logout(page);

  await login(page, dtn);
  await page.goto("/admin/selections");
  await page.getByRole("link", { name: "Diables Rouges A'" }).click();
  await expect(page).toHaveURL(/\/admin\/selections\/A_LOCAL$/);

  // Staff et calendrier
  await page.fill('input[name="fullName"]', `E2E Sélectionneur ${RUN}`);
  await page.fill('input[name="role"]', "Sélectionneur");
  await button(page, "Ajouter").click();
  await expect(page.locator("main")).toContainText(`E2E Sélectionneur ${RUN}`);
  await page.fill('input[name="opponent"]', `E2E Adversaire ${RUN}`);
  await page.fill('input[name="kickoffAt"]', "2026-11-15T16:00");
  await button(page, "Ajouter au calendrier").click();
  await expect(page.locator("main")).toContainText(`E2E Adversaire ${RUN}`);

  // Nouvelle liste de convoqués
  await page.fill('input[name="title"]', `E2E Stage de novembre ${RUN}`);
  await page.fill('input[name="location"]', "Brazzaville");
  await button(page, "Créer la liste").click();
  await expect(page).toHaveURL(/\/admin\/selections\/convocation\/\d+$/);
  const listUrl = page.url();

  // Joueur du registre (identifiant fédéral) puis joueur de l'étranger (club et pays exigés).
  await page.fill('input[name="federalId"]', federalId);
  await page.fill('input[name="shirtNumber"]', "10");
  await button(page, "Ajouter à la liste").click();
  await expect(formStatus(page)).toContainText("Joueur ajouté");
  await page.getByLabel("Joueur évoluant à l'étranger").check();
  await page.fill('input[name="externalName"]', `E2E Joueur Expatrié ${RUN}`);
  await page.fill('input[name="externalClub"]', "RC Lens");
  await page.fill('input[name="externalCountry"]', "France");
  await page.fill('input[name="shirtNumber"]', "10");
  await button(page, "Ajouter à la liste").click();
  await expect(formAlert(page)).toContainText("déjà attribué");
  await page.fill('input[name="shirtNumber"]', "9");
  await button(page, "Ajouter à la liste").click();
  await expect(page.locator("main")).toContainText("RC Lens (France)");

  // Brouillon invisible sur le portail, puis publication.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/equipes-nationales/a-locaux");
  await expect(visitor.locator("main")).not.toContainText(`E2E Stage de novembre ${RUN}`);
  await page.goto(listUrl);
  await button(page, "Publier sur le portail").click();
  await expect(page.locator("main")).toContainText("Publiée");
  await visitor.reload();
  await expect(visitor.locator("main")).toContainText(`E2E Stage de novembre ${RUN}`);
  await expect(visitor.locator("main")).toContainText(`E2E Joueur Expatrié ${RUN}`);
  await expect(visitor.locator("main")).toContainText(`E2E Sélectionneur ${RUN}`);

  // Liste PDF / Excel et lettre de convocation au club national (EF-SEL-05).
  const id = listUrl.split("/").pop();
  for (const [path, type, magic] of [
    [`/admin/exports/convocation/${id}?format=pdf`, "application/pdf", "%PDF-"],
    [`/admin/exports/convocation/${id}?format=xlsx`, "spreadsheetml", "PK"],
    [`/admin/exports/convocation/${id}/lettres`, "application/pdf", "%PDF-"],
  ] as const) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"]).toContain(type);
    expect((await res.body()).subarray(0, magic.length).toString()).toBe(magic);
  }
});
