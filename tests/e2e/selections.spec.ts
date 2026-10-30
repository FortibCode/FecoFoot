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

  // Compétition internationale : groupe, rattachement du match du Congo, match entre deux autres pays.
  await page.getByText("Nouveau groupe").click();
  // Formulaire du groupe (le calendrier a aussi un champ « Compétition »).
  const groupForm = page.locator("form", { has: page.getByRole("button", { name: "Créer le groupe" }) });
  await groupForm.locator('input[name="competition"]').fill(`E2E Éliminatoires ${RUN}`);
  await groupForm.locator('input[name="name"]').fill("Groupe Z");
  await groupForm.locator('textarea[name="countries"]').fill(`E2E Adversaire ${RUN}\nE2E Pays B ${RUN}\nE2E Pays C ${RUN}`);
  await button(page, "Créer le groupe").click();
  await expect(page.locator("main")).toContainText(`E2E Éliminatoires ${RUN} · Groupe Z`);
  const fixtureRow = page.locator("li", { hasText: `E2E Adversaire ${RUN}` }).filter({ has: page.getByRole("button", { name: "Rattacher" }) });
  await fixtureRow.locator('select[name="groupId"]').selectOption({ label: `E2E Éliminatoires ${RUN} · Groupe Z` });
  await fixtureRow.locator('input[name="matchday"]').fill("1");
  await fixtureRow.getByRole("button", { name: "Rattacher" }).click();
  const matchForm = page.locator("form", { has: page.getByRole("button", { name: "Ajouter le match" }) });
  await matchForm.locator('input[name="matchday"]').fill("1");
  await matchForm.locator('select[name="home"]').selectOption(`E2E Pays B ${RUN}`);
  await matchForm.locator('select[name="away"]').selectOption(`E2E Pays C ${RUN}`);
  await button(page, "Ajouter le match").click();
  const groupMatch = page.locator("li", { hasText: `E2E Pays B ${RUN} – E2E Pays C ${RUN}` });
  await groupMatch.locator('select[name="status"]').selectOption("PLAYED");
  await groupMatch.locator('input[name="homeGoals"]').fill("2");
  await groupMatch.locator('input[name="awayGoals"]').fill("0");
  await groupMatch.getByRole("button", { name: "OK" }).click();
  await expect(groupMatch.locator('input[name="homeGoals"]')).toHaveValue("2");

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

  // Fiche du match depuis le calendrier de la sélection : score, avant-match, convoqués publiés.
  await visitor.getByRole("link", { name: new RegExp(`E2E Adversaire ${RUN}`) }).click();
  await expect(visitor).toHaveURL(/\/matchs\/selection\/\d+$/);
  await expect(visitor.getByRole("region", { name: "Score" })).toContainText(`E2E Adversaire ${RUN}`, { ignoreCase: true });
  await expect(visitor.getByRole("tab", { name: "Avant-match" })).toHaveAttribute("aria-selected", "true");
  await visitor.getByRole("tab", { name: "Convoqués" }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Convoqués" })).toContainText(`E2E Joueur Expatrié ${RUN}`);
  await visitor.getByRole("tab", { name: "Calendrier" }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Calendrier" })).toContainText(`E2E Adversaire ${RUN}`, { ignoreCase: true });
  // Groupe : en-tête de la compétition, classement (le pays vainqueur en tête), journées.
  await expect(visitor.getByRole("region", { name: "Score" })).toContainText(`E2E Éliminatoires ${RUN} · Groupe Z · Journée 1`, { ignoreCase: true });
  await visitor.getByRole("tab", { name: "Classement", exact: true }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Total" }).locator("tbody tr").first()).toContainText(`E2E Pays B ${RUN}`);
  await visitor.getByRole("tab", { name: "Journées", exact: true }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Journées" })).toContainText(`E2E Pays C ${RUN}`);

  // Feuille de match de la sélection : composition (non publiée), but avec passeur, statistiques.
  await page.goto("/admin/selections/A_LOCAL");
  await page.locator("li", { hasText: `E2E Adversaire ${RUN}` }).getByRole("link", { name: "Feuille de match" }).click();
  await expect(page).toHaveURL(/\/admin\/selections\/A_LOCAL\/matchs\/\d+$/);
  const sheetUrl = page.url();
  await page.getByLabel(`Rôle de E2E Joueur Expatrié ${RUN}`).selectOption("starter");
  await page.fill('input[name="formation"]', "4-3-3");
  await button(page, "Enregistrer la composition").click();
  await expect(page.locator("main")).toContainText("Composition enregistrée (non publiée)");
  await page.selectOption('select[name="type"]', "GOAL");
  await page.fill('input[name="minute"]', "24");
  await page.fill('input[name="player"]', `E2E Joueur Expatrié ${RUN}`);
  await page.fill('input[name="secondPlayer"]', "E2E Passeur");
  await button(page, "Ajouter l'événement").click();
  await expect(page.locator("main")).toContainText("passe de E2E Passeur");
  await page.getByLabel(/^Possession Congo/).fill("39");
  await page.getByLabel(/^Corners Congo$/).fill("5");
  await page.getByLabel(new RegExp(`^Corners E2E Adversaire ${RUN}$`, "i")).fill("6");
  await button(page, "Enregistrer les statistiques").click();
  await expect(page.locator("main")).toContainText("Statistiques enregistrées");
  await visitor.goto(sheetUrl.replace(/.*\/matchs\//, "/matchs/selection/"));
  await visitor.getByRole("tab", { name: "Événements", exact: true }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Événements" })).toContainText("passe de E2E Passeur");
  await expect(visitor.getByRole("tabpanel", { name: "Événements" })).toContainText("61 %");
  await visitor.getByRole("tab", { name: "Compositions", exact: true }).click();
  await expect(visitor.getByRole("tabpanel", { name: "Compositions" })).toContainText("publiée ici par le staff");

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
