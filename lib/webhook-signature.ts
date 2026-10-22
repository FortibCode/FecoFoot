import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signature des rappels serveur à serveur (opérateur de paiement, passerelle) :
 * en-tête « sha256=<hex> », HMAC-SHA256 du corps brut avec le secret partagé.
 * Comparaison en temps constant ; un secret vide refuse tout.
 */
export function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export function verifySignature(body: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(header.trim());
  return expected.length === received.length && timingSafeEqual(expected, received);
}
