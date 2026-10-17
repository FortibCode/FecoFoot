import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { withDb } from "./db";
import { admin, button, createUser, e2eEmail, formStatus, login, logout, RUN } from "./helpers";

const banner = (p: Page) => p.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ });
async function scan(p: Page, code: string) {
  await p.fill('input[name="code"]', code);
  await button(p, "Contrôler").click();
}

/** Contrôle d'accès hors ligne (EF-CTL-06) : liste préchargée, décisions locales, synchronisation et conflits. */
test("contrôle hors ligne : décisions locales puis synchronisation au retour du réseau", async ({ page, browser }) => {
  const title = `E2E Hors ligne ${RUN}`;
  const digits = String(Date.now()).slice(-7);
  const phone = `06 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;

  await login(page, admin());
  const agent = await createUser(page, { fullName: "Steward E2E", email: e2eEmail("steward"), role: "TICKETING" });
  await logout(page);
  await login(page, agent);

  // Match, tribune, 3 invitations pour un Fan ID créé au guichet.
  await page.goto("/admin/billetterie");
  await page.fill('input[name="title"]', title);
  const tomorrow = new Date(Date.now() + 86_400_000 + 3_600_000).toISOString().slice(0, 10);
  await page.fill('input[name="kickoffAt"]', `${tomorrow}T16:00`);
  await button(page, "Créer l'événement").click();
  await expect(page).toHaveURL(/\/admin\/billetterie\/\d+$/);
  const eventId = page.url().split("/").pop()!;
  await page.fill('input[name="name"]', "Tribune Nord");
  await page.fill('input[name="gate"]', "Porte N");
  await page.fill('input[name="capacity"]', "50");
  await page.fill('input[name="publicPrice"]', "1000");
  await page.fill('input[name="memberPrice"]', "1000");
  await button(page, "Ajouter la tribune").click();
  await expect(page.locator("main table").first()).toContainText("Tribune Nord");
  await page.selectOption('select[name="status"]', "OPEN");
  await button(page, "Appliquer").click();
  await expect(page.getByText("Billetterie · Vente ouverte")).toBeVisible();
  await page.selectOption('select[name="channel"]', "INVITATION");
  await page.fill('input[name="phone"]', phone);
  await page.getByLabel(/Pas encore de Fan ID/).check();
  await page.fill('input[name="lastName"]', `E2E${RUN.replace(/[^a-z]/g, "")}HL`);
  await page.fill('input[name="firstName"]', "Invité");
  await page.fill('input[name="birthDate"]', "1980-01-01");
  await page.fill('input[name="idDocumentNumber"]', `E2EHL${digits}`);
  await page.selectOption('select[name="quantity"]', "3");
  await page.fill('input[name="holder_1"]', "Invité Deux");
  await page.fill('input[name="holder_2"]', "Invité Trois");
  await button(page, "Enregistrer").click();
  await expect(formStatus(page).last()).toContainText("Invitation enregistrée");
  const [t1, t2] = await withDb(async (sql) =>
    (await sql<{ token: string }[]>`select token from tickets where event_id = ${Number(eventId)} order by number`).map((r) => r.token),
  );

  // Poste A : liste préchargée, puis coupure réseau.
  await page.goto(`/admin/billetterie/controle?event=${eventId}`);
  await button(page, "Préparer le mode hors ligne").click();
  await expect(page.getByTestId("offline-panel")).toContainText("3 billet(s)");
  await page.context().setOffline(true);
  await expect(page.getByTestId("offline-panel")).toContainText("hors ligne");

  await scan(page, t1);
  await expect(banner(page)).toContainText("ENTRÉE AUTORISÉE");
  await expect(banner(page)).toContainText("Décision hors ligne");
  await scan(page, t1);
  await expect(banner(page)).toContainText("Billet déjà utilisé");
  await scan(page, "y".repeat(43));
  await expect(banner(page)).toContainText("Billet inconnu");
  await scan(page, t2);
  await expect(banner(page)).toContainText("ENTRÉE AUTORISÉE");
  await expect(page.getByTestId("offline-queue")).toContainText("2 passage(s)");

  // Poste B, resté connecté, accepte le billet 2 pendant la coupure du poste A.
  const gateB = await (await browser.newContext()).newPage();
  await login(gateB, agent);
  await gateB.goto(`/admin/billetterie/controle?event=${eventId}`);
  await scan(gateB, t2);
  await expect(banner(gateB)).toContainText("ENTRÉE AUTORISÉE");

  // Retour du réseau au poste A : synchronisation automatique, billet 2 signalé en conflit.
  await page.context().setOffline(false);
  await expect(page.getByTestId("offline-sync")).toContainText("1 entrée(s) enregistrée(s)");
  await expect(page.getByTestId("offline-sync")).toContainText("1 conflit(s)");
  await expect(page.getByTestId("offline-sync")).toContainText("Billet déjà utilisé");
  await expect(page.getByTestId("offline-queue")).toHaveCount(0);

  // Le billet 1, synchronisé, est bien enregistré comme utilisé côté serveur.
  await scan(page, t1);
  await expect(banner(page)).toContainText("Billet déjà utilisé");
  await expect(banner(page)).not.toContainText("Décision hors ligne");
});
