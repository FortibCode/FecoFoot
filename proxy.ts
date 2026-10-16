import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/**
 * Contrôle optimiste : redirige vers la connexion quand il n'y a pas de cookie.
 * Le contrôle réel (signature, compte actif, droits) est fait côté serveur
 * par requireUser / requirePermission dans chaque page et action.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
