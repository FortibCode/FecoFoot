import { describe, expect, it } from "vitest";
import { buildCsp, servedOverHttps, staticSecurityHeaders } from "@/lib/security-headers";

describe("En-têtes de sécurité (ENF-09)", () => {
  it("scripts limités au nonce de la requête, pas d'eval en production", () => {
    const csp = buildCsp("abc123", { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("développement : eval autorisé pour React ; HTTP : pas de passage forcé en HTTPS", () => {
    const csp = buildCsp("n", { dev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("HSTS uniquement en HTTPS ; caméra autorisée pour le site seulement", () => {
    expect(staticSecurityHeaders({ https: false }).map((h) => h.key)).not.toContain("Strict-Transport-Security");
    const https = staticSecurityHeaders({ https: true });
    expect(https.find((h) => h.key === "Strict-Transport-Security")?.value).toMatch(/max-age=63072000/);
    expect(https.find((h) => h.key === "Permissions-Policy")?.value).toContain("camera=(self)");
    expect(servedOverHttps("https://fecofoot.cg")).toBe(true);
    expect(servedOverHttps("http://localhost:3000")).toBe(false);
    expect(servedOverHttps(undefined)).toBe(false);
  });
});
