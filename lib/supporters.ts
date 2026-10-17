/** Supporters : Fan ID et club des supporters (M11) — fichier pur, testé unitairement. */

// ─── Téléphone Mobile Money (identifiant du Fan ID, EF-SUP-01) ──────────────

export type MobileOperator = "AIRTEL" | "MTN";

/**
 * Numéro congolais au format international +242 0X XXX XX XX (9 chiffres nationaux, commençant par 0).
 * Accepte espaces, tirets, points, préfixe +242 / 00242 / 242. Renvoie null si le numéro n'est pas valide.
 */
export function normalizeCongoPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("242") && digits.length === 12) digits = digits.slice(3);
  if (!/^0[4-6]\d{7}$/.test(digits)) return null;
  return `+242${digits}`;
}

/** Opérateur Mobile Money déduit du préfixe : 05 Airtel, 06 MTN (04 : pas de Mobile Money). */
export function operatorOf(phone: string): MobileOperator | null {
  const national = phone.replace(/^\+242/, "");
  if (national.startsWith("05")) return "AIRTEL";
  if (national.startsWith("06")) return "MTN";
  return null;
}

/** Affichage : +242 06 123 45 67. */
export function formatCongoPhone(phone: string): string {
  const n = phone.replace(/^\+242/, "");
  return n.length === 9 ? `+242 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}` : phone;
}

// ─── Fan ID ──────────────────────────────────────────────────────────────────

export const formatFanId = (n: number) => `FAN-${String(n).padStart(6, "0")}`;

export const ID_DOCUMENT_TYPES = ["CNI", "PASSPORT", "RESIDENCE", "OTHER"] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];
export const ID_DOCUMENT_LABELS: Record<IdDocumentType, string> = {
  CNI: "Carte nationale d'identité",
  PASSPORT: "Passeport",
  RESIDENCE: "Carte de séjour",
  OTHER: "Autre pièce officielle",
};

/** Âge minimal pour créer seul un Fan ID (un mineur plus jeune passe par le guichet avec un adulte). */
export const MIN_FAN_AGE = 13;

// ─── Club des supporters (EF-SUP-03 à 05, RG-15) ────────────────────────────

export const MEMBERSHIP_TIERS = ["ADULT", "YOUTH"] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];
export const MEMBERSHIP_TIER_LABELS: Record<MembershipTier, string> = { ADULT: "Adulte", YOUTH: "Jeune" };

/** Âge limite de la formule « jeune » (moins de 18 ans au début de la saison). */
export const YOUTH_MAX_AGE = 17;

export function ageOnSeasonStart(birthDate: Date, seasonStart: number): number {
  const start = new Date(Date.UTC(seasonStart, 6, 1));
  let age = start.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = start.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && start.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export function tierError(tier: MembershipTier, birthDate: Date, seasonStart: number): string | null {
  if (tier === "YOUTH" && ageOnSeasonStart(birthDate, seasonStart) > YOUTH_MAX_AGE) {
    return `La formule « jeune » est réservée aux moins de ${YOUTH_MAX_AGE + 1} ans au 1er juillet.`;
  }
  return null;
}

/** Points de fidélité (RG-15) : 1 point par adhésion, plus les points de chaque match réellement fréquenté. */
export const POINTS_PER_MEMBERSHIP = 1;
