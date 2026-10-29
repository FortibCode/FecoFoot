/**
 * Formations des dirigeants et subventions aux clubs (communiqué du Comex du 28 octobre 2026) —
 * fichier pur, testé unitairement.
 */

// ─── Formations ──────────────────────────────────────────────────────────────

export const TRAINING_ROLES = ["CLUB_PRESIDENT", "CLUB_SECRETARY", "LEAGUE_PRESIDENT", "OTHER"] as const;
export type TrainingRole = (typeof TRAINING_ROLES)[number];
export const TRAINING_ROLE_LABELS: Record<TrainingRole, string> = {
  CLUB_PRESIDENT: "Président(e) de club",
  CLUB_SECRETARY: "Secrétaire général(e) de club",
  LEAGUE_PRESIDENT: "Président(e) de ligue",
  OTHER: "Autre dirigeant(e)",
};

export const REGISTRATION_STATUSES = ["REGISTERED", "CANCELLED"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Jours d'une formation (dates ISO AAAA-MM-JJ), bornes comprises. */
export function trainingDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const d = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (d <= end && days.length < 60) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Contrôle d'une inscription : inscriptions ouvertes, places restantes, pas de doublon, rôle cohérent. */
export function registrationError(ctx: {
  open: boolean;
  capacity: number | null;
  registered: number;
  duplicate: boolean;
  role: TrainingRole;
  forClub: boolean;
  forLeague: boolean;
}): string | null {
  if (!ctx.open) return "Les inscriptions à cette formation sont closes.";
  if (ctx.duplicate) return "Cette personne est déjà inscrite à la formation.";
  if (ctx.capacity !== null && ctx.registered >= ctx.capacity) return `Formation complète (${ctx.capacity} places).`;
  if ((ctx.role === "CLUB_PRESIDENT" || ctx.role === "CLUB_SECRETARY") && !ctx.forClub) return "Choisissez le club du dirigeant.";
  if (ctx.role === "LEAGUE_PRESIDENT" && !ctx.forLeague) return "Choisissez la ligue du dirigeant.";
  return null;
}

/** Un club est représenté s'il a au moins un dirigeant présent un jour de la formation. */
export const clubAttended = (registrations: { clubId: number | null; status: RegistrationStatus; presentDays: string[] }[], clubId: number) =>
  registrations.some((r) => r.clubId === clubId && r.status === "REGISTERED" && r.presentDays.length > 0);

// ─── Subventions aux clubs ───────────────────────────────────────────────────

export const GRANT_STATUSES = ["DRAFT", "SIGNED", "PAID", "CLOSED", "CANCELLED"] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];
export const GRANT_STATUS_LABELS: Record<GrantStatus, string> = {
  DRAFT: "Convention à signer",
  SIGNED: "Convention signée",
  PAID: "Versée — à justifier",
  CLOSED: "Clôturée",
  CANCELLED: "Annulée",
};

export const EXPENSE_STATUSES = ["SUBMITTED", "ACCEPTED", "REJECTED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = { SUBMITTED: "À examiner", ACCEPTED: "Acceptée", REJECTED: "Refusée" };

export type GrantAction = "sign" | "pay" | "close" | "cancel";

/**
 * Cycle d'une subvention : convention déposée puis signée par le club → versement (date, référence)
 * → clôture une fois les dépenses justifiées à hauteur du montant versé. Annulation possible avant clôture.
 */
export function grantTransitionError(
  status: GrantStatus,
  action: GrantAction,
  ctx: { hasConvention: boolean; hasSignedConvention: boolean; justified: number; amount: number },
): string | null {
  switch (action) {
    case "sign":
      if (status !== "DRAFT") return "La convention n'est plus à signer.";
      if (!ctx.hasConvention) return "Déposez d'abord la convention de la fédération.";
      if (!ctx.hasSignedConvention) return "Déposez la convention signée par le club.";
      return null;
    case "pay":
      return status === "SIGNED" ? null : "Le versement suit la signature de la convention.";
    case "close":
      if (status !== "PAID") return "Seule une subvention versée peut être clôturée.";
      if (ctx.justified < ctx.amount) return `Dépenses justifiées insuffisantes : ${ctx.justified} sur ${ctx.amount} FCFA.`;
      return null;
    case "cancel":
      return status === "CLOSED" || status === "CANCELLED" ? "Cette subvention ne peut plus être annulée." : null;
  }
}

/** Justification d'une subvention : dépenses acceptées, en attente d'examen, reste à justifier. */
export function justification(amount: number, expenses: { amount: number; status: ExpenseStatus }[]) {
  const accepted = expenses.filter((e) => e.status === "ACCEPTED").reduce((s, e) => s + e.amount, 0);
  const pending = expenses.filter((e) => e.status === "SUBMITTED").reduce((s, e) => s + e.amount, 0);
  return { accepted, pending, remaining: Math.max(0, amount - accepted), rate: amount > 0 ? Math.min(100, Math.round((accepted / amount) * 100)) : 0 };
}

export const formatGrantNumber = (year: number, n: number) => `SUB-${year}-${String(n).padStart(4, "0")}`;
