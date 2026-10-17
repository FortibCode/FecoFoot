import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou ENF-11 : dans un fichier « use server », chaque fonction exportée devient appelable
 * depuis le navigateur. Elle doit donc contrôler l'accès (require…) — sauf les actions
 * volontairement publiques, listées ici.
 */
const PUBLIC_ACTIONS = new Set([
  "login", // connexion
  "logout",
  "verifyTwoFactor", // 2e étape de connexion (jeton intermédiaire signé)
  "requestPasswordReset", // mot de passe oublié
  "resetPassword", // lien de réinitialisation
  "answerConsent", // accord en ligne du joueur / tuteur (lien personnel)
  "registerSupporter", // création d'un Fan ID en ligne
  "loginSupporter",
  "logoutSupporter",
  "requestAccreditation", // demande d'accréditation d'un journaliste (sans compte)
]);

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return serverActionFiles(full);
    if (!/\.tsx?$/.test(name)) return [];
    return /^\s*["']use server["']/.test(readFileSync(full, "utf8")) ? [full] : [];
  });
}

describe("Actions serveur : contrôle d'accès systématique (ENF-11)", () => {
  const files = serverActionFiles(path.resolve("app"));

  it("trouve les fichiers d'actions", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    // N'exporte que des fonctions (pas de réexport d'aides internes non protégées).
    it(`${path.relative(process.cwd(), file)} n'exporte que des actions`, () => {
      expect(source).not.toMatch(/^export\s*\{/m);
      expect(source).not.toMatch(/^export\s+(const|let|function\s)/m);
    });

    for (const match of source.matchAll(/^export async function (\w+)\([^]*?\n}/gm)) {
      const [body, name] = match;
      it(`${name} contrôle l'accès`, () => {
        if (PUBLIC_ACTIONS.has(name)) return;
        expect(body, `${name} doit appeler requireUser / requirePermission / requireAnyPermission / requireSupporter`).toMatch(
          /require(User|Permission|AnyPermission|Supporter)\(/,
        );
      });
    }
  }
});
