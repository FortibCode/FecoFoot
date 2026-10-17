import { expect, test } from "./fixtures";
import { admin, login } from "./helpers";

/** En-têtes de sécurité (ENF-09) et bon fonctionnement des scripts sous CSP. */
test("sécurité : en-têtes, CSP à nonce unique, interactivité intacte", async ({ page, request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=(self)");
  expect(h["x-powered-by"]).toBeUndefined();
  const csp = h["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");

  // Nonce différent à chaque requête, et porté par les scripts de la page.
  const nonceOf = (value: string) => value.match(/'nonce-([^']+)'/)![1];
  const second = (await request.get("/")).headers()["content-security-policy"];
  expect(nonceOf(second)).not.toBe(nonceOf(csp));
  await page.goto("/");
  const pageNonce = await page.evaluate(() => (document.querySelector("script[nonce]") as HTMLScriptElement | null)?.nonce ?? "");
  expect(pageNonce.length).toBeGreaterThan(10);

  // L'interactivité dépend des scripts : changer le profil d'un compte fait apparaître le choix de la ligue.
  await login(page, admin());
  await page.goto("/admin/utilisateurs/nouveau");
  await expect(page.locator('select[name="leagueId"]')).toHaveCount(0);
  await page.selectOption('select[name="role"]', "LEAGUE");
  await expect(page.locator('select[name="leagueId"]')).toBeVisible();
});
