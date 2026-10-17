/** Paiements Mobile Money (M16) — règles pures, partagées par le schéma et l'interface. */

export const PAYMENT_METHODS = ["AIRTEL_MONEY", "MTN_MOMO", "CASH"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { AIRTEL_MONEY: "Airtel Money", MTN_MOMO: "MTN MoMo", CASH: "Espèces (guichet)" };

export const PAYMENT_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "EXPIRED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente de confirmation",
  SUCCEEDED: "Payé",
  FAILED: "Échoué",
  EXPIRED: "Expiré",
  REFUNDED: "Remboursé",
};

export const PAYMENT_PURPOSES = ["MEMBERSHIP", "TICKET_ORDER", "LICENSE_FEE"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

/** Méthode Mobile Money d'après l'opérateur du numéro. */
export const methodForOperator = (op: "AIRTEL" | "MTN" | null): PaymentMethod | null =>
  op === "AIRTEL" ? "AIRTEL_MONEY" : op === "MTN" ? "MTN_MOMO" : null;

/** Référence de paiement lisible : préfixe + horodatage + aléa, ex. PAY-MBR-K3F9Q2X7. */
export const paymentReference = (purpose: PaymentPurpose, random: string) =>
  `PAY-${{ MEMBERSHIP: "MBR", TICKET_ORDER: "TKT", LICENSE_FEE: "LIC" }[purpose]}-${random.toUpperCase()}`;
