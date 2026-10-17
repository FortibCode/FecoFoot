import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { buildCsp, servedOverHttps } from "@/lib/security-headers";

/**
 * 1. Politique de sécurité du contenu (ENF-09) : un nonce aléatoire par requête, que Next applique
 *    automatiquement à ses scripts ; tout autre script est bloqué par le navigateur.
 * 2. Contrôle optimiste de l'espace fédéral : redirection vers la connexion sans cookie de session.
 *    Le contrôle réel (signature, compte actif, droits) est fait côté serveur par requireUser / requirePermission.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin") && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development", https: servedOverHttps(process.env.APP_URL) });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Toutes les pages, sauf les fichiers statiques et les médias (pas de script à protéger).
      source: "/((?!_next/static|_next/image|favicon.ico|media/|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
