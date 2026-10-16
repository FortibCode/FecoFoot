/** Règles des transferts (M06, EF-TRF-01 à 03, RG-06) — fichier pur, testé unitairement. */

export const TRANSFER_TYPES = ["DEFINITIVE", "LOAN", "FREE"] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  DEFINITIVE: "Transfert définitif",
  LOAN: "Prêt",
  FREE: "Transfert libre",
};

export const TRANSFER_STATUSES = ["PENDING", "FORWARDED", "APPROVED", "REFUSED", "CANCELLED"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  PENDING: "En instruction (ligue)",
  FORWARDED: "Transmis à la fédération",
  APPROVED: "Approuvé",
  REFUSED: "Refusé",
  CANCELLED: "Annulé",
};

/** Un transfert « en cours » bloque toute nouvelle demande pour le joueur (EF-TRF-02). */
export const ACTIVE_TRANSFER_STATUSES: TransferStatus[] = ["PENDING", "FORWARDED"];

export const formatTransferNumber = (season: number, n: number) => `TRF-${season}-${String(n).padStart(4, "0")}`;

/** Contrôles de saisie d'une demande de transfert. */
export function transferRequestError(req: {
  type: TransferType;
  fromClubId: number | null;
  toClubId: number;
  fee: number;
  loanEndDate: Date | null;
  now?: Date;
}): string | null {
  const now = req.now ?? new Date();
  if (req.fromClubId === req.toClubId) return "Le club d'accueil doit être différent du club actuel.";
  if (!Number.isInteger(req.fee) || req.fee < 0) return "L'indemnité doit être un montant entier en FCFA.";
  if (req.type === "FREE" && req.fee !== 0) return "Un transfert libre ne donne pas lieu à indemnité.";
  if (req.type === "LOAN") {
    if (!req.loanEndDate) return "La date de fin de prêt est obligatoire.";
    if (req.loanEndDate.getTime() <= now.getTime()) return "La date de fin de prêt doit être dans le futur.";
  } else if (req.loanEndDate) {
    return "Une date de fin ne s'applique qu'à un prêt.";
  }
  return null;
}

export type TransferAction = "forward" | "approve" | "refuse" | "cancel";

const TRANSITIONS: Record<TransferAction, { from: TransferStatus[]; to: TransferStatus; permission: "transfers.review" | "transfers.approve" }> = {
  // La ligue instruit et transmet (ou refuse en instruction via « cancel » par le demandeur).
  forward: { from: ["PENDING"], to: "FORWARDED", permission: "transfers.review" },
  // La fédération approuve ou refuse une demande instruite.
  approve: { from: ["FORWARDED"], to: "APPROVED", permission: "transfers.approve" },
  refuse: { from: ["PENDING", "FORWARDED"], to: "REFUSED", permission: "transfers.approve" },
  cancel: { from: ["PENDING", "FORWARDED"], to: "CANCELLED", permission: "transfers.review" },
};

/**
 * Accord du club quitté (EF-TRF-05) : exigé pour un transfert définitif ou un prêt depuis un club.
 * Un transfert libre (fin de contrat) n'en a pas besoin.
 */
export const needsRelease = (t: { type: TransferType; fromClubId: number | null }) => t.fromClubId !== null && t.type !== "FREE";

export function transferTransition(
  status: TransferStatus,
  action: TransferAction,
  ctx: { releaseGranted: boolean | null; needsRelease: boolean } = { releaseGranted: null, needsRelease: false },
): { to: TransferStatus; permission: string } | { error: string } {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(status)) return { error: `Action impossible sur un transfert « ${TRANSFER_STATUS_LABELS[status]} ».` };
  if (action === "forward" && ctx.needsRelease && ctx.releaseGranted !== true) {
    return { error: "Le club quitté n'a pas donné son accord : la demande ne peut pas être transmise." };
  }
  return { to: rule.to, permission: rule.permission };
}

// ─── Fenêtres de transfert (EF-TRF-04) ───────────────────────────────────────

export type TransferWindow = { name: string; opensOn: Date; closesOn: Date };

/** Fenêtre ouverte à cette date (bornes incluses, jour entier à l'heure de Brazzaville, UTC+1), ou null. */
export function openWindow(windows: TransferWindow[], at: Date = new Date()): TransferWindow | null {
  const day = new Date(at.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
  return windows.find((w) => w.opensOn.toISOString().slice(0, 10) <= day && day <= w.closesOn.toISOString().slice(0, 10)) ?? null;
}

/** Le transfert libre (joueur en fin de contrat) reste possible hors fenêtre, comme le prévoit le règlement FIFA. */
export function windowError(type: TransferType, windows: TransferWindow[], at: Date = new Date()): string | null {
  if (type === "FREE" || openWindow(windows, at)) return null;
  return "Aucune fenêtre de transfert n'est ouverte : seuls les transferts libres sont possibles en dehors des fenêtres.";
}

/** Licences clôturées à l'approbation : toutes celles de la saison encore « vivantes » (RG-06). */
export const LICENSE_STATUSES_CLOSED_BY_TRANSFER = ["PENDING", "PAID", "VALIDATED", "SUSPENDED"] as const;
