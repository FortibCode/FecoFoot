import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Tests de bout en bout (parcours critiques, §8.2 et §10.2).
 * Ils s'exécutent sur l'application locale ; les données créées portent le préfixe « E2E »
 * et sont supprimées à la fin (tests/e2e/teardown.ts).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  // Le serveur de développement compile chaque page à sa première visite.
  expect: { timeout: 15_000 },
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // Téléphone : la plateforme est « mobile first » (EF-PUB-07).
    ...devices["Pixel 7"],
    locale: "fr-FR",
    timezoneId: "Africa/Brazzaville",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/connexion",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
