import { test as base, expect } from "@playwright/test";

/**
 * Tous les parcours tournent sous la politique de sécurité du contenu (ENF-09) :
 * la moindre ressource ou le moindre script bloqué par la CSP fait échouer le test.
 * (Les formulaires marchent même sans JavaScript : sans ce contrôle, une CSP trop stricte passerait inaperçue.)
 */
export const test = base.extend<{ cspGuard: void }>({
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] };
      w.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await provide(context);
  },
  cspGuard: [
    async ({ context }, provide) => {
      await provide();
      for (const p of context.pages()) {
        if (p.isClosed()) continue;
        const violations = await p.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []).catch(() => []);
        expect(violations, `violations CSP sur ${p.url()}`).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
