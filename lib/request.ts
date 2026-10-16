import "server-only";
import { headers } from "next/headers";

/**
 * Adresse IP du client. En production, l'application est derrière un proxy inverse
 * qui renseigne X-Forwarded-For : seule la première adresse est retenue.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
