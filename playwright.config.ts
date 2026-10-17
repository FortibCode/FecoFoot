import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";
import path from "node:path";

/**
 * Tests de bout en bout (parcours critiques, §8.2 et §10.2).
 * Ils s'exécutent sur l'application locale ; les données créées portent le préfixe « E2E »
 * et sont supprimées à la fin (tests/e2e/teardown.ts).
 */
// En intégration continue, on teste le serveur de production autonome (celui de l'image Docker) ; en local, le serveur de développement.
const port = process.env.E2E_PORT ?? "3000";
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

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
    baseURL,
    // Téléphone : la plateforme est « mobile first » (EF-PUB-07).
    ...devices["Pixel 7"],
    locale: "fr-FR",
    timezoneId: "Africa/Brazzaville",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI ? "npm run start:standalone" : "npm run dev",
    // Dossier des fichiers en chemin absolu : le serveur autonome tourne depuis .next/standalone,
    // et le nettoyage final (teardown) doit supprimer les fichiers de test au même endroit.
    env: { PORT: port, HOSTNAME: "localhost", UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR ?? "uploads") },
    url: `${baseURL}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
