import { cookies } from "next/headers";
import { LaunchOverlay } from "@/components/public/launch-overlay";
import { LAUNCH_COOKIE } from "@/lib/launch";

/**
 * Écran d'ouverture du portail : affiché à la première page de la visite seulement (cookie de session posé par
 * l'écran). Décidé côté serveur pour apparaître avant le contenu, sans clignotement.
 */
export async function LaunchScreen() {
  const seen = (await cookies()).has(LAUNCH_COOKIE);
  return seen ? null : <LaunchOverlay />;
}
