/** Accréditations médias (M13) — fichier pur, testé unitairement. EF-MED-01 à 05, RG-16. */

export const PRESS_ZONES = ["PRESS_BOX", "PITCHSIDE", "MIXED_ZONE", "PRESS_CONFERENCE"] as const;
export type PressZone = (typeof PRESS_ZONES)[number];
export const PRESS_ZONE_LABELS: Record<PressZone, string> = {
  PRESS_BOX: "Tribune de presse",
  PITCHSIDE: "Bord terrain (photo)",
  MIXED_ZONE: "Zone mixte",
  PRESS_CONFERENCE: "Conférence de presse",
};

export const PRESS_ROLES = ["JOURNALIST", "PHOTOGRAPHER", "CAMERA", "RADIO", "TECHNICIAN"] as const;
export type PressRole = (typeof PRESS_ROLES)[number];
export const PRESS_ROLE_LABELS: Record<PressRole, string> = {
  JOURNALIST: "Journaliste",
  PHOTOGRAPHER: "Photographe",
  CAMERA: "Cadreur / vidéo",
  RADIO: "Radio",
  TECHNICIAN: "Technicien",
};

export const ACCREDITATION_STATUSES = ["PENDING", "APPROVED", "REFUSED"] as const;
export type AccreditationStatus = (typeof ACCREDITATION_STATUSES)[number];
export const ACCREDITATION_STATUS_LABELS: Record<AccreditationStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  REFUSED: "Refusée",
};

/** Demandes closes 24 h avant le coup d'envoi (EF-MED-02, RG-16). */
export const REQUEST_DEADLINE_HOURS = 24;
export const requestDeadline = (kickoffAt: Date) => new Date(kickoffAt.getTime() - REQUEST_DEADLINE_HOURS * 3_600_000);

export function requestError(ctx: { kickoffAt: Date; eventCancelled: boolean; zones: string[]; now?: Date }): string | null {
  const now = ctx.now ?? new Date();
  if (ctx.eventCancelled) return "Ce match est annulé.";
  if (now.getTime() >= requestDeadline(ctx.kickoffAt).getTime()) return "Les demandes d'accréditation sont closes 24 h avant le coup d'envoi.";
  if (ctx.zones.length === 0) return "Choisissez au moins une zone.";
  if (ctx.zones.some((z) => !(PRESS_ZONES as readonly string[]).includes(z))) return "Zone inconnue.";
  return null;
}

/**
 * Quotas par zone (EF-MED-05) : `granted` = places déjà accordées dans la zone (hors la demande traitée).
 * Une zone sans quota défini n'est pas limitée.
 */
export function quotaError(zones: PressZone[], granted: Partial<Record<PressZone, number>>, quotas: Partial<Record<PressZone, number>>): string | null {
  for (const z of zones) {
    const quota = quotas[z];
    if (quota !== undefined && (granted[z] ?? 0) >= quota) return `Quota atteint pour « ${PRESS_ZONE_LABELS[z]} » (${quota} place(s)).`;
  }
  return null;
}

export const formatAccreditationNumber = (n: number) => `ACC-${String(n).padStart(5, "0")}`;

/** Adresse de la photo d'un badge (route /accreditations/photo/[jeton]) ; la clé de version change avec le fichier. */
export const pressPhotoUrl = (a: { badgeToken: string; photoKey: string | null }) => (a.photoKey ? `/accreditations/photo/${a.badgeToken}?v=${a.photoKey.slice(-12, -4)}` : null);

/**
 * Validité d'un badge au scan (page de vérification) : approuvé, match non annulé et pas encore terminé
 * (jusqu'à 4 h après le coup d'envoi). Le badge n'est valable que pour son match (RG-16).
 */
export function badgeValidity(ctx: { status: AccreditationStatus; kickoffAt: Date; eventCancelled: boolean; now: Date }): { ok: boolean; reason: string } {
  if (ctx.status === "REFUSED") return { ok: false, reason: "Accréditation refusée." };
  if (ctx.status !== "APPROVED") return { ok: false, reason: "Accréditation pas encore validée par le service communication." };
  if (ctx.eventCancelled) return { ok: false, reason: "Le match a été annulé." };
  if (ctx.kickoffAt.getTime() + 4 * 3_600_000 < ctx.now.getTime()) return { ok: false, reason: "Le match est terminé : le badge n'est valable que pour ce match." };
  return { ok: true, reason: "Badge authentique, valable pour ce match." };
}

/** Jours entiers restants avant la clôture des demandes (0 le dernier jour). */
export const requestDaysLeft = (kickoffAt: Date, now = Date.now()) => Math.max(0, Math.ceil((requestDeadline(kickoffAt).getTime() - now) / 86_400_000));
