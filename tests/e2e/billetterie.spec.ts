import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { admin, button, createUser, e2eEmail, formAlert, formStatus, login, logout, RUN } from "./helpers";

const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** Inscription d'un supporter (Fan ID) dans un navigateur sans session. */
async function newSupporter(page: Page, lastName: string, phone: string) {
  await page.goto("/supporters/inscription");
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="firstName"]', "Acheteur");
  await page.fill('input[name="birthDate"]', "1992-03-03");
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="idDocumentNumber"]', `E2E${phone.replace(/\D/g, "")}`);
  await page.fill('input[name="password"]', "Supporter2026");
  await page.check('input[name="consent"]');
  await button(page, "Créer mon Fan ID").click();
  await expect(page).toHaveURL(/\/supporters\/espace$/);
}

/**
 * Billetterie (M10) et contrôle d'accès (M12) — scénarios de recette §10.2 :
 * achat de 2 billets payés par Mobile Money, places décomptées ; même billet présenté deux fois refusé.
 */
test("billetterie : prévente, achat, plafond, jauge, guichet, remboursement et contrôle d'accès", async ({ page, browser }) => {
  const title = `E2E Congo – Gabon ${RUN}`;
  const digits = String(Date.now()).slice(-7);
  const phone = `05 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  const lastName = `E2E${RUN.replace(/[^a-z]/g, "")}`.toUpperCase();

  await login(page, admin());
  const agent = await createUser(page, { fullName: "Agent billetterie E2E", email: e2eEmail("guichet"), role: "TICKETING" });
  await logout(page);
  await login(page, agent);

  // Événement et tribunes
  await page.goto("/admin/billetterie");
  await page.fill('input[name="title"]', title);
  const tomorrow = new Date(Date.now() + 86_400_000 + 3_600_000).toISOString().slice(0, 10);
  await page.fill('input[name="kickoffAt"]', `${tomorrow}T16:00`);
  await button(page, "Créer l'événement").click();
  await expect(page).toHaveURL(/\/admin\/billetterie\/\d+$/);
  const eventUrl = page.url();
  for (const [name, gate, capacity, pub, member] of [["Tribune d'honneur", "Porte A", "3", "5000", "4000"], ["Virages", "Porte F", "100", "1000", "1000"]]) {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="gate"]', gate);
    await page.fill('input[name="capacity"]', capacity);
    await page.fill('input[name="publicPrice"]', pub);
    await page.fill('input[name="memberPrice"]', member);
    await button(page, "Ajouter la tribune").click();
    await expect(page.locator("main table").first()).toContainText(name);
  }
  await page.selectOption('select[name="status"]', "PRESALE");
  await button(page, "Appliquer").click();
  await expect(formStatus(page).filter({ hasText: "Statut de vente" })).toBeVisible();
  const slug = (await page.getByRole("link", { name: "Page publique" }).getAttribute("href"))!;

  // Prévente : réservée aux membres (RG-12)
  const fan = await (await browser.newContext()).newPage();
  await newSupporter(fan, lastName, phone);
  await fan.goto(slug);
  await expect(fan.locator("main [role=\"alert\"]")).toContainText("Prévente réservée aux membres");

  await page.selectOption('select[name="status"]', "OPEN");
  await button(page, "Appliquer").click();
  await expect(page.getByText("Billetterie · Vente ouverte")).toBeVisible();

  // Le match apparaît dans la liste publique des matchs en vente (calculée à chaque visite).
  await fan.goto("/billetterie");
  await fan.getByRole("link", { name: new RegExp(title) }).click();
  await expect(fan).toHaveURL(new RegExp(slug));

  // Photo d'identité exigée avant le premier achat en ligne (EF-SUP-08).
  await button(fan, "Réserver et payer").click();
  await expect(fan.locator('main [role="alert"]')).toContainText("photo d'identité");
  await fan.goto("/supporters/espace");
  await fan.getByLabel("Ajouter ma photo : fichier").setInputFiles({ name: "moi.png", mimeType: "image/png", buffer: PNG_1PX });
  await button(fan, "Ajouter ma photo").click();
  await expect(fan.getByRole("img", { name: "Ma photo d'identité" })).toBeVisible();
  const photoUrl = (await fan.getByRole("img", { name: "Ma photo d'identité" }).getAttribute("src"))!;
  // Donnée personnelle : la photo n'est pas servie sans session.
  expect((await (await browser.newContext()).request.get(new URL(photoUrl, fan.url()).href)).status()).toBe(404);
  await fan.goto(slug);

  // Achat de 2 billets nominatifs payés par Mobile Money (Airtel : numéro en 05)
  await expect(fan.locator('select[name="method"]')).toHaveValue("AIRTEL_MONEY");
  const honneurOnline = await fan.locator('select[name="categoryId"] option', { hasText: "Tribune d'honneur" }).getAttribute("value");
  await fan.selectOption('select[name="categoryId"]', honneurOnline!);
  await fan.selectOption('select[name="quantity"]', "2");
  await fan.fill('input[name="holder_1"]', "Marie Porteur");
  await expect(fan.locator("main")).toContainText(/Total : 10\s000\sFCFA/);
  await button(fan, "Réserver et payer").click();
  await expect(fan).toHaveURL(/\/paiement\/PAY-TKT-/);
  await button(fan, "Confirmer le paiement").click();
  await expect(fan).toHaveURL(/\/supporters\/espace$/);
  const eTickets = fan.getByRole("article", { name: /^Billet TKT-/ });
  await expect(eTickets).toHaveCount(2);
  await expect(eTickets.nth(1)).toContainText("Marie Porteur");
  await expect(eTickets.first()).toContainText("Valide");
  const ticketHref = (await fan.locator('main a[href^="/billet/"]').first().getAttribute("href"))!;
  const token = ticketHref.split("/").pop()!;

  // L'agent compare la photo à la pièce d'identité et la marque vérifiée.
  await page.goto(`/admin/supporters?q=${lastName}`);
  await page.getByRole("link", { name: new RegExp(`^${lastName} Acheteur`) }).click();
  await expect(page.getByRole("img", { name: new RegExp(`Photo de Acheteur ${lastName}`) })).toBeVisible();
  await button(page, "Pièce d'identité vérifiée sur présentation").click();
  await expect(page.locator("main dl")).not.toContainText(/Pièce vérifiée\s*Non/);

  // Places décomptées (1 restante) ; plafond de 4 billets par Fan ID (RG-10) ; jauge sans survente.
  await fan.goto(slug);
  await expect(fan.locator("main ul li").filter({ hasText: "Tribune d'honneur" })).toContainText("1 place(s) disponible(s)");
  await expect(fan.locator('select[name="quantity"] option')).toHaveCount(1); // limité par la jauge restante

  // Guichet : nouveau Fan ID créé sur pièce d'identité, dernière place en espèces → tribune complète.
  const counterPhone = `06 ${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  await page.goto(eventUrl);
  await page.fill('input[name="phone"]', counterPhone);
  await page.getByLabel(/Pas encore de Fan ID/).check();
  await page.fill('input[name="lastName"]', `${lastName}GUICHET`);
  await page.fill('input[name="firstName"]', "Client");
  await page.fill('input[name="birthDate"]', "1985-06-06");
  await page.fill('input[name="idDocumentNumber"]', `E2EG${digits}`);
  const honneur = await page.locator('select[name="categoryId"] option', { hasText: "Tribune d'honneur" }).getAttribute("value");
  await page.selectOption('select[name="categoryId"]', honneur!);
  await button(page, "Enregistrer").click();
  await expect(formStatus(page).last()).toContainText(/Vente enregistrée : commande CMD-/);
  await fan.reload();
  await expect(fan.locator("main ul li").filter({ hasText: "Tribune d'honneur" })).toContainText("complet");

  // Une 2e vente sur la tribune complète est refusée.
  await page.fill('input[name="phone"]', counterPhone);
  await page.selectOption('select[name="categoryId"]', honneur!);
  await button(page, "Enregistrer").click();
  await expect(formAlert(page).last()).toContainText("complète");

  // Remboursement de la vente au guichet : la place revient en vente (EF-BIL-09).
  await page.reload();
  const counterRow = page.locator("main tr").filter({ hasText: `${lastName}GUICHET` });
  await counterRow.getByRole("button", { name: "Rembourser" }).click();
  await expect(page.locator("main tr").filter({ hasText: `${lastName}GUICHET` })).toContainText("Remboursée");
  await fan.reload();
  await expect(fan.locator("main ul li").filter({ hasText: "Tribune d'honneur" })).toContainText("1 place(s) disponible(s)");
  // Clôture de caisse : la vente remboursée n'apparaît plus.
  await expect(page.locator("main")).toContainText("Aucune vente au guichet");

  // Contrôle d'accès : billet accepté, puis refusé au 2e passage ; billet inconnu refusé.
  await page.goto(`/admin/billetterie/controle?event=${eventUrl.split("/").pop()}`);
  const scan = async (p: Page, code: string) => {
    await p.fill('input[name="code"]', code);
    await button(p, "Contrôler").click();
  };
  await scan(page, `https://fecofoot.cg/billet/${token}`);
  await expect(page.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ })).toContainText("ENTRÉE AUTORISÉE");
  await expect(page.getByTestId("entries")).toHaveText("1");
  await scan(page, token);
  await expect(page.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ })).toContainText("Billet déjà utilisé");
  await scan(page, "x".repeat(43));
  await expect(page.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ })).toContainText("Billet inconnu");

  // Deux portes lisent le 2e billet au même instant : une seule entrée acceptée (EF-CTL-02).
  const secondToken = (await fan.goto("/supporters/espace").then(() => fan.locator('main a[href^="/billet/"]').nth(1).getAttribute("href")))!.split("/").pop()!;
  const gateB = await (await browser.newContext()).newPage();
  await login(gateB, agent);
  await gateB.goto(page.url());
  await page.fill('input[name="code"]', secondToken);
  await gateB.fill('input[name="code"]', secondToken);
  await Promise.all([button(page, "Contrôler").click(), button(gateB, "Contrôler").click()]);
  const verdicts = await Promise.all(
    [page, gateB].map(async (p) => {
      const banner = p.getByRole("status").filter({ hasText: /ENTRÉE|REFUSÉ/ });
      // Le poste A affichait encore le contrôle précédent (« Billet inconnu ») : on attend le nouveau verdict.
      await expect(banner).toBeVisible();
      await expect(banner).not.toContainText("Billet inconnu");
      return (await banner.textContent())!;
    }),
  );
  expect(verdicts.filter((v) => v.includes("ENTRÉE AUTORISÉE"))).toHaveLength(1);
  expect(verdicts.filter((v) => v.includes("déjà utilisé"))).toHaveLength(1);

  // Comptage par porte (EF-CTL-07) : 2 entrées à la porte A, sur 3 places desservies ; refus non comptés.
  await page.reload();
  const gateA = page.getByTestId("gate-Porte A");
  await expect(gateA.getByTestId("gate-entries")).toHaveText("2");
  await expect(gateA).toContainText("Fluide");
  await expect(page.getByTestId("gate-Porte F").getByTestId("gate-entries")).toHaveText("0");

  // Point de fidélité du match fréquenté (RG-15) ; tableau de bord.
  await fan.goto("/supporters/espace");
  await expect(fan.getByTestId("fan-points")).toHaveText("1");
  await page.goto(eventUrl);
  await expect(page.getByTestId("kpi-Entrées contrôlées")).toHaveText("2");
  await expect(page.getByTestId("kpi-Recettes")).toHaveText(/10\s000\sFCFA/);
});
