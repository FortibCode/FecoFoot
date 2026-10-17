/**
 * En-têtes de sécurité (ENF-09) — fichier pur, partagé par le proxy et la configuration Next, testé unitairement.
 */

/**
 * Politique de sécurité du contenu (CSP).
 * - scripts : uniquement ceux qui portent le nonce de la requête (ajouté automatiquement par Next) — c'est la
 *   protection principale contre l'injection de script ; `unsafe-eval` seulement en développement (React) ;
 * - styles en ligne autorisés : Next et quelques mises en page (carte de licence) en utilisent, risque faible ;
 * - images : le site lui-même, les QR codes (data:) et l'aperçu caméra (blob:) ;
 * - aucun cadre ni objet ; formulaires uniquement vers le site ;
 * - HTTPS imposé pour toutes les ressources quand le site est servi en HTTPS.
 */
export function buildCsp(nonce: string, opts: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** En-têtes fixes, valables pour toutes les réponses. HSTS uniquement quand le site est servi en HTTPS. */
export function staticSecurityHeaders(opts: { https: boolean }): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Caméra autorisée pour le site lui-même (lecture des QR codes au contrôle d'accès), le reste interdit.
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
    ...(opts.https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}

/** Le site est-il servi en HTTPS ? (adresse publique APP_URL) */
export const servedOverHttps = (appUrl: string | undefined) => (appUrl ?? "").startsWith("https://");
