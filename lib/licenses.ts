/**
 * Règles de gestion des joueurs et licences (M04) — fichier pur, testé unitairement.
 * RG-01 à RG-05 du cahier des charges.
 */

// ─── Saison (RG-03) ──────────────────────────────────────────────────────────

const BRAZZAVILLE_OFFSET_MS = 60 * 60 * 1000; // UTC+1, sans heure d'été

/** Année de début de la saison en cours : la saison court du 1er juillet au 30 juin. */
export function seasonOf(date: Date = new Date()): number {
  const local = new Date(date.getTime() + BRAZZAVILLE_OFFSET_MS);
  const year = local.getUTCFullYear();
  return local.getUTCMonth() >= 6 ? year : year - 1;
}

export const seasonLabel = (start: number) => `${start}-${start + 1}`;

/** Fin de validité d'une licence : 30 juin à 23h59 (heure de Brazzaville) de l'année suivante. */
export function seasonExpiry(start: number): Date {
  return new Date(Date.UTC(start + 1, 5, 30, 23, 59, 59) - BRAZZAVILLE_OFFSET_MS);
}

// ─── Catégories d'âge (RG-04, EF-LIC-04) ─────────────────────────────────────

export const CATEGORIES = ["U13", "U15", "U17", "U20", "SENIOR", "VETERAN"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  U13: "Moins de 13 ans",
  U15: "Moins de 15 ans",
  U17: "Moins de 17 ans",
  U20: "Moins de 20 ans",
  SENIOR: "Senior",
  VETERAN: "Vétéran (35 ans et plus)",
};

/** Âge retenu : calculé sur l'année de début de saison. */
export const seasonAge = (birthDate: Date, seasonStart: number) => seasonStart - birthDate.getUTCFullYear();

export function naturalCategory(birthDate: Date, seasonStart: number): Category {
  const age = seasonAge(birthDate, seasonStart);
  if (age < 13) return "U13";
  if (age < 15) return "U15";
  if (age < 17) return "U17";
  if (age < 20) return "U20";
  if (age < 35) return "SENIOR";
  return "VETERAN";
}

/** Surclassement maximal autorisé pour un jeune : une catégorie au-dessus de la sienne. */
export const MAX_UPGRADE = 1;

/**
 * Surclassement autorisé (d'une catégorie), sous-classement refusé.
 * Un vétéran peut jouer en senior ; la catégorie vétéran est réservée aux 35 ans et plus.
 */
export function categoryError(birthDate: Date, seasonStart: number, requested: Category): string | null {
  const natural = naturalCategory(birthDate, seasonStart);
  if (requested === natural) return null;
  if (natural === "VETERAN") return requested === "SENIOR" ? null : "Un vétéran ne peut jouer qu'en senior ou en vétéran.";
  if (requested === "VETERAN") return "La catégorie vétéran est réservée aux joueurs de 35 ans et plus.";

  const gap = CATEGORIES.indexOf(requested) - CATEGORIES.indexOf(natural);
  if (gap < 0) return `Sous-classement refusé : le joueur relève de la catégorie « ${CATEGORY_LABELS[natural]} ».`;
  if (gap > MAX_UPGRADE) return `Surclassement limité à une catégorie au-dessus de « ${CATEGORY_LABELS[natural]} ».`;
  return null;
}

// ─── Identifiants (RG-01) ────────────────────────────────────────────────────

/** Identifiant fédéral du joueur : FCF-J-2026-000001 (année d'enregistrement + séquence jamais réutilisée). */
export function formatFederalId(year: number, n: number): string {
  return `FCF-J-${year}-${String(n).padStart(6, "0")}`;
}

/** Numéro de licence : LIC-2026-000001 (année de début de saison + séquence). */
export function formatLicenseNumber(seasonStart: number, n: number): string {
  return `LIC-${seasonStart}-${String(n).padStart(6, "0")}`;
}

/** Clé anti-doublon (EF-LIC-02) : nom + prénom normalisés (sans accents, casse, espaces) + date de naissance. */
export function identityKey(lastName: string, firstName: string, birthDate: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  return `${norm(lastName)}|${norm(firstName)}|${birthDate}`;
}

/** Âge civil exact à une date donnée (pour savoir si le joueur est mineur). */
export function ageAt(birthDate: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = at.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

export const isMinor = (birthDate: Date, at: Date = new Date()) => ageAt(birthDate, at) < 18;

// ─── Cycle de vie de la licence (EF-LIC-05) ──────────────────────────────────

export const LICENSE_STATUSES = ["PENDING", "PAID", "TO_CORRECT", "VALIDATED", "REJECTED", "SUSPENDED", "REVOKED", "EXPIRED", "TRANSFERRED"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  PENDING: "En attente",
  PAID: "Droits encaissés",
  TO_CORRECT: "Corrections demandées",
  VALIDATED: "Validée",
  REJECTED: "Rejetée",
  SUSPENDED: "Suspendue",
  REVOKED: "Révoquée",
  EXPIRED: "Expirée",
  TRANSFERRED: "Close (transfert)",
};

/** Méthode du contrôle d'identité : pièces justificatives (agent), ou biométrie (prestataire intégré). */
export const IDENTITY_METHODS = ["DOCUMENTS", "BIOMETRIC"] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];
export const IDENTITY_METHOD_LABELS: Record<IdentityMethod, string> = { DOCUMENTS: "sur pièces justificatives", BIOMETRIC: "biométrique" };

export const LICENSE_TYPES = ["AMATEUR", "PRO"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = { AMATEUR: "Amateur", PRO: "Professionnelle" };

export type LicenseAction = "pay" | "validate" | "reject" | "correct" | "suspend" | "reactivate" | "revoke";

const TRANSITIONS: Record<LicenseAction, { from: LicenseStatus[]; to: LicenseStatus }> = {
  pay: { from: ["PENDING"], to: "PAID" },
  validate: { from: ["PAID"], to: "VALIDATED" },
  reject: { from: ["PENDING", "PAID", "TO_CORRECT"], to: "REJECTED" },
  // Dossier renvoyé au club pour corrections (motif obligatoire) ; il le soumet à nouveau (resubmitStatus).
  correct: { from: ["PENDING", "PAID"], to: "TO_CORRECT" },
  suspend: { from: ["VALIDATED"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "VALIDATED" },
  // Retrait définitif (fraude, erreur grave) : la licence ne redevient jamais valide.
  revoke: { from: ["VALIDATED", "SUSPENDED"], to: "REVOKED" },
};

/** Actions qui exigent un motif (journalisé et communiqué au club). */
export const REASON_REQUIRED: LicenseAction[] = ["reject", "correct", "suspend", "revoke"];

/** Statut d'un dossier soumis à nouveau après corrections : il reprend où il en était (droits déjà encaissés ou non). */
export const resubmitStatus = (paid: boolean): LicenseStatus => (paid ? "PAID" : "PENDING");

/**
 * Nouvel état après une action, ou message d'erreur.
 * La validation exige les droits encaissés ET un accord en ligne valide (RG-05, EF-LIC-06).
 */
export function transition(
  status: LicenseStatus,
  action: LicenseAction,
  ctx: {
    hasValidConsent: boolean;
    expired: boolean;
    /** Justificatifs obligatoires manquants (libellés). */
    missingDocuments?: string[];
    /** Identité contrôlée par un agent habilité (pièces ou, plus tard, biométrie). */
    identityVerified?: boolean;
  },
): { to: LicenseStatus } | { error: string } {
  if (ctx.expired) return { error: "La licence est expirée : aucune action n'est possible." };
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(status)) {
    return { error: `Action impossible sur une licence « ${LICENSE_STATUS_LABELS[status]} ».` };
  }
  if (action === "validate") {
    if (!ctx.hasValidConsent) return { error: "Validation impossible : l'accord en ligne du joueur (ou de son représentant légal) manque." };
    if (ctx.missingDocuments?.length) return { error: `Validation impossible : justificatif(s) manquant(s) — ${ctx.missingDocuments.join(", ")}.` };
    if (ctx.identityVerified === false) return { error: "Validation impossible : confirmez d'abord le contrôle de l'identité du joueur sur pièces." };
  }
  return { to: rule.to };
}

/**
 * Statut présenté sur la carte et à la vérification publique : « active » pour une licence validée en cours de
 * validité, « en attente » pour un dossier en cours d'instruction.
 */
export const CARD_STATUSES = ["ACTIVE", "PENDING", "EXPIRED", "SUSPENDED", "REVOKED", "CLOSED"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];
export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  ACTIVE: "Active",
  PENDING: "En attente",
  EXPIRED: "Expirée",
  SUSPENDED: "Suspendue",
  REVOKED: "Révoquée",
  CLOSED: "Close",
};

export function cardStatus(status: LicenseStatus, expiresAt: Date, now: Date = new Date()): CardStatus {
  const s = effectiveStatus(status, expiresAt, now);
  if (s === "VALIDATED") return "ACTIVE";
  if (s === "PENDING" || s === "PAID" || s === "TO_CORRECT") return "PENDING";
  if (s === "EXPIRED" || s === "SUSPENDED" || s === "REVOKED") return s;
  return "CLOSED";
}

/** Une carte n'est délivrée (affichage, PDF, impression) que pour une licence ayant été validée. */
export const cardIssued = (status: LicenseStatus) => status === "VALIDATED" || status === "SUSPENDED" || status === "REVOKED" || status === "EXPIRED";

/** Statut affiché : une licence validée ou suspendue dont la saison est terminée est expirée. */
export function effectiveStatus(status: LicenseStatus, expiresAt: Date, now: Date = new Date()): LicenseStatus {
  if ((status === "VALIDATED" || status === "SUSPENDED") && now.getTime() > expiresAt.getTime()) return "EXPIRED";
  return status;
}

// ─── Accord en ligne (M05) ───────────────────────────────────────────────────

/** Lien personnel valable 14 jours (EF-ACC-02). */
export const CONSENT_LINK_DAYS = 14;
/** Au-delà, le lien est bloqué : le club doit envoyer une nouvelle demande. */
export const CONSENT_MAX_FAILED_CHECKS = 5;
/** Accord valable 5 ans pour le club (EF-ACC-05). */
export const CONSENT_VALIDITY_YEARS = 5;

export const CONSENT_STATUSES = ["PENDING", "ACCEPTED", "REFUSED", "CANCELLED"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  PENDING: "En attente de réponse",
  ACCEPTED: "Accord donné",
  REFUSED: "Refusé",
  CANCELLED: "Remplacé par une nouvelle demande",
};

export function consentLinkExpiry(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + CONSENT_LINK_DAYS * 24 * 60 * 60 * 1000);
}

export function consentValidUntil(acceptedAt: Date): Date {
  const d = new Date(acceptedAt);
  d.setUTCFullYear(d.getUTCFullYear() + CONSENT_VALIDITY_YEARS);
  return d;
}

/** Un accord compte pour la validation s'il est donné, pour ce club, et encore dans sa période de 5 ans. */
export function isConsentValid(
  consent: { status: ConsentStatus; clubId: number; validUntil: Date | null } | undefined,
  clubId: number,
  now: Date = new Date(),
): boolean {
  return Boolean(
    consent &&
      consent.status === "ACCEPTED" &&
      consent.clubId === clubId &&
      consent.validUntil &&
      consent.validUntil.getTime() > now.getTime(),
  );
}

// ─── Libellés joueurs ────────────────────────────────────────────────────────

export const POSITIONS = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_LABELS: Record<Position, string> = {
  GOALKEEPER: "Gardien",
  DEFENDER: "Défenseur",
  MIDFIELDER: "Milieu",
  FORWARD: "Attaquant",
};
export const GENDER_LABELS = { M: "Masculin", F: "Féminin" } as const;

/** Date au format AAAA-MM-JJ (valeur d'un champ <input type="date">). */
export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
