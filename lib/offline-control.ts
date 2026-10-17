/**
 * Contrôle d'accès hors ligne (EF-CTL-06) — fichier pur, utilisé dans le navigateur du poste de contrôle.
 * La liste préchargée ne contient que l'empreinte SHA-256 des jetons : un appareil perdu ne permet pas
 * de fabriquer des billets valides.
 */
import type { ScanRefusal } from "./ticketing";

export type OfflineTicket = {
  h: string;
  number: string;
  holder: string;
  category: string;
  gate: string;
  status: "VALID" | "USED";
  banned: boolean;
  /** Badge presse approuvé : entrées multiples autorisées (EF-CTL-04). */
  badge?: boolean;
};
export type OfflineList = { eventId: number; downloadedAt: string; tickets: OfflineTicket[] };
export type OfflineScan = { token: string; gate: string; at: string };

/** Empreinte SHA-256 (hexadécimal) d'un jeton — identique côté serveur et navigateur. */
export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Décision locale : billet absent de la liste, déjà passé (avant la coupure ou sur cet appareil), Fan ID interdit. */
export function offlineVerdict(ticket: OfflineTicket | undefined, usedHere: Set<string>): ScanRefusal | null {
  if (!ticket) return "UNKNOWN";
  if (ticket.badge) return null;
  if (ticket.status === "USED" || usedHere.has(ticket.h)) return "ALREADY_USED";
  if (ticket.banned) return "BANNED";
  return null;
}
