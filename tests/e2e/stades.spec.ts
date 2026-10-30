import { expect, test } from "./fixtures";
import { seasonOf } from "../../lib/licenses";
import { withDb } from "./db";
import { admin, button, expectNoHorizontalScroll, formStatus, login, RUN } from "./helpers";

/**
 * Stade enregistré et billetterie reliée : la fédération crée un stade, programme un match dans ce stade,
 * ouvre la vente ; la fiche publique montre l'avant-match, la fiche du stade, l'achat et l'ajout à l'agenda.
 */
test("stade et billetterie : fiche du stade, avant-match, acheter un billet, agenda", async ({ page, browser }) => {
  const stadium = `E2E Stade ${RUN}`;
  await login(page, admin());
  await page.goto("/admin/stades");
  await page.fill('input[name="name"]', stadium);
  await page.fill('input[name="city"]', "Brazzaville");
  await page.fill('input[name="capacity"]', "25000");
  await page.selectOption('select[name="surface"]', "Pelouse naturelle");
  await button(page, "Enregistrer le stade").click();
  await expect(formStatus(page)).toContainText("Stade enregistré");
  await expect(page.locator("main table")).toContainText(stadium);

  // Match programmé dans 3 jours entre deux clubs de test.
  const { matchId, slug } = await withDb(async (sql) => {
    const clubs: number[] = [];
    for (const [i, name] of [`E2E Stade Lions ${RUN}`, `E2E Stade Aigles ${RUN}`].entries()) {
      const [c] = await sql<{ id: number }[]>`
        insert into clubs (affiliation_number, name, slug, city, status)
        values (${`E2E-ST-${RUN}-${i}`.slice(0, 16)}, ${name}, ${`e2e-stade-${RUN}-${i}`}, 'Brazzaville', 'AFFILIATED') returning id`;
      clubs.push(c.id);
    }
    const [comp] = await sql<{ id: number }[]>`
      insert into competitions (name, slug, season, category, type, status)
      values (${`E2E Stades ${RUN}`}, ${`e2e-stades-${RUN}`}, ${seasonOf()}, 'SENIOR', 'LEAGUE', 'ONGOING') returning id`;
    await sql`insert into competition_teams (competition_id, club_id) values (${comp.id}, ${clubs[0]}), (${comp.id}, ${clubs[1]})`;
    const [m] = await sql<{ id: number }[]>`
      insert into matches (competition_id, round, home_club_id, away_club_id, kickoff_at, status)
      values (${comp.id}, 1, ${clubs[0]}, ${clubs[1]}, date_trunc('hour', now()) + interval '3 days', 'SCHEDULED') returning id`;
    const slug = `e2e-billets-${RUN}`;
    await sql`insert into ticket_events (slug, title, kind, venue, kickoff_at, sales_status, match_id)
      values (${slug}, ${`E2E Billets ${RUN}`}, 'LEAGUE', ${stadium}, now() + interval '3 days', 'OPEN', ${m.id})`;
    return { matchId: m.id, slug };
  });

  // Programmation dans le stade enregistré : le lieu affiché suit le stade.
  await page.goto(`/admin/matchs/${matchId}`);
  await page.selectOption('select[name="stadiumId"]', { label: `${stadium} — Brazzaville` });
  await button(page, "Programmer").click();
  await expect(page.locator("main")).toContainText("Programmation enregistrée");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/matchs/${matchId}`);
  // Avant le coup d'envoi, l'avant-match est ouvert d'office.
  await expect(visitor.getByRole("tab", { name: "Avant-match" })).toHaveAttribute("aria-selected", "true");
  const panel = visitor.getByRole("tabpanel");
  await expect(panel).toContainText(`Le stade · ${stadium}`);
  await expect(panel).toContainText(/25\s000 places/);
  await expect(panel).toContainText("Aucun joueur suspendu");
  await expect(visitor.getByRole("link", { name: /Acheter un billet/ })).toHaveAttribute("href", `/billetterie/${slug}`);
  await expect(visitor.getByRole("link", { name: "Ajouter ce match à mon agenda" })).toBeVisible();
  const ics = await visitor.request.get(`/matchs/${matchId}/agenda`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain(`LOCATION:${stadium}\\, Brazzaville`);
  await expectNoHorizontalScroll(visitor);
});
