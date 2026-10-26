import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { extractLink, latestNotification, withDb } from "./db";
import { admin, button, createUser, e2eEmail, formAlert, login, logout, RUN } from "./helpers";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function createEvent(page: Page, title: string, kickoff: Date) {
  await page.goto("/admin/billetterie");
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="kickoffAt"]', new Date(kickoff.getTime() + 3_600_000).toISOString().slice(0, 16));
  await button(page, "Créer l'événement").click();
  await expect(page).toHaveURL(/\/admin\/billetterie\/\d+$/);
  const id = page.url().split("/").pop()!;
  await page.fill('input[name="name"]', "Tribune");
  await page.fill('input[name="gate"]', "Porte A");
  await page.fill('input[name="capacity"]', "10");
  await page.fill('input[name="publicPrice"]', "1000");
  await page.fill('input[name="memberPrice"]', "1000");
  await button(page, "Ajouter la tribune").click();
  await expect(page.locator("main table").first()).toContainText("Tribune");
  await page.selectOption('select[name="status"]', "OPEN");
  await button(page, "Appliquer").click();
  await expect(page.getByText("Billetterie · Vente ouverte")).toBeVisible();
  return id;
}

async function requestFor(p: Page, title: string, who: { last: string; phone: string; role: string; zones: string[] }) {
  await p.goto("/accreditations");
  await p.getByRole("link", { name: new RegExp(title) }).click();
  await p.fill('input[name="lastName"]', who.last);
  await p.fill('input[name="firstName"]', "Reporter");
  await p.fill('input[name="phone"]', who.phone);
  await p.fill('input[name="outlet"]', "Journal E2E");
  await p.selectOption('select[name="role"]', who.role);
  await p.fill('input[name="pressCardNumber"]', `CP-${who.phone.replace(/\D/g, "")}`);
  for (const box of await p.locator('input[name="zones"]').all()) await box.uncheck();
  for (const z of who.zones) await p.check(`input[name="zones"][value="${z}"]`);
  await p.locator('input[name="photo"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG_1PX });
  await button(p, "Envoyer la demande").click();
}

/** Accréditations médias (M13) et badges presse au contrôle d'accès (EF-CTL-04). */
test("accréditations : demande, quotas, validation, badge et contrôle d'accès", async ({ page, browser }) => {
  const title = `E2E Accréditations ${RUN}`;
  const digits = String(Date.now()).slice(-7);
  const phoneA = `06 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  const phoneB = `05 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  const phoneC = `04 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;

  await login(page, admin());
  const ticketing = await createUser(page, { fullName: "Billetterie Presse E2E", email: e2eEmail("billet-presse"), role: "TICKETING" });
  const com = await createUser(page, { fullName: "Communication E2E", email: e2eEmail("com"), role: "COMMUNICATION" });
  await logout(page);
  await login(page, ticketing);
  const eventId = await createEvent(page, title, new Date(Date.now() + 3 * 86_400_000));
  // Un match dans 12 h : demandes déjà closes (EF-MED-02).
  await createEvent(page, `E2E Trop tard ${RUN}`, new Date(Date.now() + 12 * 3_600_000));

  // Demandes des journalistes (sans compte)
  const press = await (await browser.newContext()).newPage();
  await press.goto("/accreditations");
  await expect(press.locator("main")).not.toContainText(`E2E Trop tard ${RUN}`);
  await requestFor(press, title, { last: `E2EPHOTOA${RUN}`, phone: phoneA, role: "PHOTOGRAPHER", zones: ["PRESS_BOX", "PITCHSIDE"] });
  await expect(press).toHaveURL(/\/accreditations\/suivi\//);
  await expect(press.getByRole("heading", { level: 1 })).toHaveText("En attente");
  const trackingA = press.url();
  const sms = await latestNotification(`+242${phoneA.replace(/\s/g, "")}`, "accreditation_request");
  expect(extractLink(sms!.body)).toBe(trackingA);

  await requestFor(press, title, { last: `E2EPHOTOA${RUN}`, phone: phoneA, role: "PHOTOGRAPHER", zones: ["PRESS_BOX"] });
  await expect(formAlert(press)).toContainText("existe déjà");
  await requestFor(press, title, { last: `E2EPHOTOB${RUN}`, phone: phoneB, role: "PHOTOGRAPHER", zones: ["PITCHSIDE"] });
  await expect(press).toHaveURL(/\/accreditations\/suivi\//);
  await requestFor(press, title, { last: `E2EATTENTE${RUN}`, phone: phoneC, role: "JOURNALIST", zones: ["MIXED_ZONE"] });
  await expect(press).toHaveURL(/\/accreditations\/suivi\//);

  // Communication : quota d'une place en bord terrain (EF-MED-05), validations (EF-MED-03)
  await logout(page);
  await login(page, com);
  await page.goto(`/admin/accreditations?event=${eventId}`);
  await expect(page.getByTestId("acc-À traiter")).toHaveText("3");
  await page.fill('input[name="quota_PITCHSIDE"]', "1");
  await button(page, "Enregistrer les quotas").click();
  await expect(page.locator("main")).toContainText("Quotas enregistrés");

  // Noms distincts par construction (« A » / « B ») : aucun ne contient l'autre, quel que soit RUN.
  const rowA = page.locator("main li").filter({ hasText: `E2EPHOTOA${RUN}`.toUpperCase() });
  await rowA.getByRole("button", { name: "Approuver" }).click();
  await expect(rowA).toContainText("Approuvée");
  const rowB = page.locator("main li").filter({ hasText: `E2EPHOTOB${RUN}`.toUpperCase() });
  await rowB.getByRole("button", { name: "Approuver" }).click();
  await expect(rowB).toContainText("Quota atteint");
  await rowB.getByLabel(/Bord terrain/).uncheck();
  await rowB.getByLabel(/Tribune de presse/).check();
  await rowB.getByRole("button", { name: "Approuver" }).click();
  await expect(rowB).toContainText("Approuvée");
  await expect(page.getByTestId("acc-Dont bord terrain (photo)")).toHaveText("1");

  // Le journaliste suit sa demande et récupère son badge (EF-MED-04)
  await press.goto(trackingA);
  await expect(press.getByRole("heading", { level: 1 })).toHaveText("Approuvée");
  await press.getByRole("link", { name: "Mon badge" }).click();
  const badge = press.getByRole("article", { name: "Badge presse" });
  await expect(badge).toContainText("Bord terrain (photo)");
  await expect(badge.locator("svg")).toHaveCount(1);
  await expect(badge.getByRole("img", { name: /^Photo de/ })).toBeVisible();
  const badgeUrl = press.url();
  // Badge PDF (A6) et page de vérification ouverte au scan du QR code, en lecture seule.
  const pdf = await press.request.get(`${badgeUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await press.goto(`${badgeUrl}/verifier`);
  await expect(press.locator("main").getByRole("status")).toContainText("Badge presse valable");
  await expect(press.locator("main")).toContainText("Journal E2E");

  // Contrôle d'accès : badge accepté plusieurs fois (EF-CTL-04) ; badge en attente refusé.
  await logout(page);
  await login(page, ticketing);
  await page.goto(`/admin/billetterie/controle?event=${eventId}`);
  const banner = page.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ });
  for (let i = 0; i < 2; i++) {
    await page.fill('input[name="code"]', badgeUrl);
    await button(page, "Contrôler").click();
    await expect(banner).toContainText("ENTRÉE AUTORISÉE");
    await expect(banner).toContainText("Journal E2E");
  }
  const pendingBadge = await withDb(async (sql) => (await sql<{ badge_token: string }[]>`select badge_token from accreditations where last_name = ${`E2EATTENTE${RUN}`.toUpperCase()}`)[0].badge_token);
  await page.fill('input[name="code"]', pendingBadge);
  await button(page, "Contrôler").click();
  await expect(banner).toContainText("Badge presse non validé");

  // Fiche d'un membre de la presse : voir, modifier, supprimer (refusé si le badge a servi au stade).
  await logout(page);
  await login(page, com);
  await page.goto(`/admin/accreditations?event=${eventId}`);
  const nameA = `Reporter ${`E2EPHOTOA${RUN}`.toUpperCase()}`;
  await page.getByRole("link", { name: `Voir ${nameA}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nameA);
  await expect(page.locator("main")).toContainText("Entrées au stade");
  await page.fill('input[name="outlet"]', "Journal E2E Modifié");
  await button(page, "Enregistrer").click();
  await expect(page.locator("main").getByRole("status").filter({ hasText: "Fiche mise à jour" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).locator("xpath=..")).toContainText("Journal E2E Modifié");
  await page.getByRole("button", { name: `Supprimer la demande de ${nameA}` }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator("dialog[open]").getByRole("alert")).toContainText("déjà servi au stade");
  await page.locator("dialog[open]").getByRole("button", { name: "Fermer" }).click();

  // Demande en attente : suppression depuis la liste.
  await page.goto(`/admin/accreditations?event=${eventId}`);
  const nameWait = `Reporter ${`E2EATTENTE${RUN}`.toUpperCase()}`;
  await page.getByRole("button", { name: `Supprimer ${nameWait}` }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.locator("main")).not.toContainText(nameWait);
});
