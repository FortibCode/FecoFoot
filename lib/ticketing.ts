/** Billetterie (M10) et contrôle d'accès (M12) — fichier pur, testé unitairement. */

export const SALES_STATUSES = ["DRAFT", "PRESALE", "OPEN", "CLOSED", "CANCELLED"] as const;
export type SalesStatus = (typeof SALES_STATUSES)[number];
export const SALES_STATUS_LABELS: Record<SalesStatus, string> = {
  DRAFT: "Brouillon",
  PRESALE: "Prévente membres",
  OPEN: "Vente ouverte",
  CLOSED: "Vente clôturée",
  CANCELLED: "Annulé",
};

export const EVENT_KINDS = ["NATIONAL_TEAM", "LEAGUE", "CUP", "OTHER"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  NATIONAL_TEAM: "Équipe nationale",
  LEAGUE: "Championnat",
  CUP: "Coupe",
  OTHER: "Autre",
};

export const ORDER_CHANNELS = ["ONLINE", "COUNTER", "INVITATION"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = { ONLINE: "En ligne", COUNTER: "Guichet", INVITATION: "Invitation" };

export const ORDER_STATUSES = ["PENDING", "PAID", "EXPIRED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "En attente de paiement",
  PAID: "Payée",
  EXPIRED: "Expirée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export const TICKET_STATUSES = ["RESERVED", "VALID", "USED", "CANCELLED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Plafond de billets par Fan ID et par match, par défaut (RG-10). */
export const DEFAULT_MAX_TICKETS_PER_FAN = 4;
/** Places réservées pendant le paiement (EF-BIL-06, RG-11). */
export const RESERVATION_MINUTES = 15;

/** Peut-on acheter en ligne ? Prévente : membres de la saison uniquement (RG-12) ; interdiction de stade : jamais (RG-14). */
export function purchaseError(ctx: { status: SalesStatus; isMember: boolean; banned: boolean; kickoffAt: Date; now?: Date }): string | null {
  const now = ctx.now ?? new Date();
  if (ctx.banned) return "Votre Fan ID fait l'objet d'une interdiction de stade.";
  if (ctx.kickoffAt.getTime() <= now.getTime()) return "Le match a commencé : la vente est close.";
  if (ctx.status === "PRESALE") return ctx.isMember ? null : "Prévente réservée aux membres du club des supporters.";
  if (ctx.status === "OPEN") return null;
  return "La vente n'est pas ouverte pour ce match.";
}

/** Tarif membre pour les adhérents de la saison, tarif public sinon (EF-SUP-04). */
export const unitPrice = (cat: { publicPrice: number; memberPrice: number }, isMember: boolean) => (isMember ? Math.min(cat.memberPrice, cat.publicPrice) : cat.publicPrice);

/** Plafond par Fan ID et par match (RG-10). */
export function capError(alreadyHeld: number, requested: number, max: number): string | null {
  if (requested < 1) return "Choisissez au moins un billet.";
  if (alreadyHeld + requested > max) {
    const left = Math.max(0, max - alreadyHeld);
    return left === 0 ? `Vous avez déjà atteint le plafond de ${max} billets pour ce match.` : `Plafond de ${max} billets par Fan ID : vous pouvez encore en prendre ${left}.`;
  }
  return null;
}

/** Places restantes d'une tribune (jamais négatif). */
export const remaining = (capacity: number, taken: number) => Math.max(0, capacity - taken);

export const formatTicketNumber = (n: number) => `TKT-${String(n).padStart(7, "0")}`;

// ─── Contrôle d'accès (EF-CTL-02, EF-CTL-03) ─────────────────────────────────

export type ScanRefusal = "UNKNOWN" | "OTHER_EVENT" | "CANCELLED" | "NOT_PAID" | "ALREADY_USED" | "BANNED" | "BADGE_NOT_APPROVED";

export const SCAN_REFUSAL_LABELS: Record<ScanRefusal, string> = {
  UNKNOWN: "Billet inconnu",
  OTHER_EVENT: "Billet d'un autre match",
  CANCELLED: "Billet annulé",
  NOT_PAID: "Billet non payé",
  ALREADY_USED: "Billet déjà utilisé",
  BANNED: "Fan ID interdit de stade",
  BADGE_NOT_APPROVED: "Badge presse non validé",
};

/**
 * Motif de refus d'un billet présenté, ou null s'il peut entrer.
 * (Le passage effectif reste une mise à jour atomique en base : deux portes ne peuvent pas accepter le même billet.)
 */
export function scanRefusal(
  ticket: { eventId: number; status: TicketStatus; holderBanned: boolean } | null,
  eventId: number,
): ScanRefusal | null {
  if (!ticket) return "UNKNOWN";
  if (ticket.eventId !== eventId) return "OTHER_EVENT";
  if (ticket.status === "CANCELLED") return "CANCELLED";
  if (ticket.status === "RESERVED") return "NOT_PAID";
  if (ticket.status === "USED") return "ALREADY_USED";
  if (ticket.holderBanned) return "BANNED";
  return null;
}

/** Extrait le jeton d'un QR code de billet ou de badge presse (URL …/billet/<jeton> ou …/badge/<jeton>, ou jeton seul). */
export function ticketTokenFrom(scanned: string): string | null {
  const text = scanned.trim();
  const m = text.match(/\/(?:billet|badge)\/([A-Za-z0-9_-]{20,100})/) ?? text.match(/^([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

// ─── Comptage par porte et alerte de saturation (EF-CTL-07) ─────────────────

/** Fenêtre de calcul du débit d'entrées. */
export const GATE_FLOW_WINDOW_MINUTES = 5;
/** Seuil d'alerte : 80 % du débit maximal ou de la capacité de la porte. */
export const GATE_WARN_RATIO = 0.8;

export type GateLevel = "OK" | "WARN" | "SATURATED";
export const GATE_LEVEL_LABELS: Record<GateLevel, string> = { OK: "Fluide", WARN: "Vigilance", SATURATED: "Saturée" };

/**
 * Charge d'une porte : débit sur les dernières minutes rapporté au débit maximal du match,
 * et remplissage (entrées / capacité des tribunes desservies). Le niveau retenu est le plus élevé des deux.
 */
export function gateLoad(g: { entries: number; recentEntries: number; capacity: number; flowLimit: number; windowMinutes?: number }) {
  const perMinute = g.recentEntries / (g.windowMinutes ?? GATE_FLOW_WINDOW_MINUTES);
  const flowRatio = g.flowLimit > 0 ? perMinute / g.flowLimit : 0;
  const fill = g.capacity > 0 ? g.entries / g.capacity : 0;
  const level = (r: number): GateLevel => (r >= 1 ? "SATURATED" : r >= GATE_WARN_RATIO ? "WARN" : "OK");
  const rank = { OK: 0, WARN: 1, SATURATED: 2 } as const;
  const byFlow = level(flowRatio);
  const byFill = level(fill);
  const worst = rank[byFlow] >= rank[byFill] ? byFlow : byFill;
  const reasons: string[] = [];
  if (byFlow !== "OK") reasons.push(`débit ${Math.round(perMinute * 10) / 10} entrées/min (max. ${g.flowLimit})`);
  if (byFill !== "OK") reasons.push(`${Math.round(fill * 100)} % de la capacité`);
  return { perMinute, fill, level: worst, reasons };
}

/** Nom de porte normalisé : « porte a », « Porte A » et « PORTE  A » désignent la même porte. */
export const gateKey = (gate: string) => gate.trim().replace(/\s+/g, " ").toLowerCase();
