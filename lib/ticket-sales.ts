import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { PRESS_ZONE_LABELS, type PressZone } from "@/lib/accreditations";
import {
  accreditations,
  memberships,
  payments,
  scanRefusals as scanRefusalsTable,
  supporterPoints,
  supporters,
  ticketCategories,
  ticketEvents,
  ticketNumberSeq,
  ticketOrders,
  tickets,
} from "@/lib/db/schema";
import { seasonOf } from "@/lib/licenses";
import { randomToken } from "@/lib/tokens";
import {
  capError,
  formatTicketNumber,
  purchaseError,
  RESERVATION_MINUTES,
  scanRefusal,
  unitPrice,
  type OrderChannel,
  type ScanRefusal,
} from "@/lib/ticketing";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Billets qui occupent une place : réservés (paiement en cours), valides ou utilisés. */
const HOLDING = ["RESERVED", "VALID", "USED"] as const;

/** Libère les places des commandes non payées dans les 15 minutes (RG-11). */
export async function expireStaleOrders(): Promise<void> {
  await db.transaction(async (tx) => {
    const stale = await tx
      .update(ticketOrders)
      .set({ status: "EXPIRED" })
      .where(and(eq(ticketOrders.status, "PENDING"), lt(ticketOrders.expiresAt, new Date())))
      .returning({ id: ticketOrders.id });
    if (stale.length === 0) return;
    const ids = stale.map((o) => o.id);
    await tx.update(tickets).set({ status: "CANCELLED" }).where(and(inArray(tickets.orderId, ids), eq(tickets.status, "RESERVED")));
    await tx
      .update(payments)
      .set({ status: "EXPIRED" })
      .where(and(eq(payments.purpose, "TICKET_ORDER"), inArray(payments.targetId, ids), eq(payments.status, "PENDING")));
  });
}

export async function isActiveMember(supporterId: number, season = seasonOf()): Promise<boolean> {
  const [m] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.supporterId, supporterId), eq(memberships.season, season), eq(memberships.status, "ACTIVE")))
    .limit(1);
  return Boolean(m);
}

/** Places occupées par tribune. */
export async function takenByCategory(eventId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ categoryId: tickets.categoryId, n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventId), inArray(tickets.status, [...HOLDING])))
    .groupBy(tickets.categoryId);
  return new Map(rows.map((r) => [r.categoryId, r.n]));
}

export type OrderRequest = {
  eventId: number;
  categoryId: number;
  supporterId: number;
  /** Porteurs des billets supplémentaires (le premier billet est au nom de l'acheteur). */
  extraHolders: string[];
  channel: OrderChannel;
  soldBy: number | null;
};

/**
 * Création d'une commande (EF-BIL-04 à 06, EF-BIL-08) dans une transaction qui verrouille la tribune :
 * deux acheteurs simultanés ne peuvent pas obtenir la dernière place (pas de survente).
 * En ligne : billets réservés 15 minutes en attente du paiement. Guichet et invitations : billets valides aussitôt.
 */
export async function createOrder(req: OrderRequest): Promise<{ orderId: number; reference: string; total: number } | { error: string }> {
  await expireStaleOrders();
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(ticketEvents).where(eq(ticketEvents.id, req.eventId)).limit(1);
    if (!event) return { error: "Match introuvable." };
    // Verrou de la tribune : les commandes concurrentes sur cette tribune attendent leur tour.
    const [category] = await tx
      .select()
      .from(ticketCategories)
      .where(and(eq(ticketCategories.id, req.categoryId), eq(ticketCategories.eventId, req.eventId)))
      .for("update")
      .limit(1);
    if (!category) return { error: "Tribune introuvable." };
    const [buyer] = await tx.select().from(supporters).where(eq(supporters.id, req.supporterId)).limit(1);
    if (!buyer) return { error: "Fan ID introuvable." };

    const member = await isActiveMemberTx(tx, buyer.id);
    if (req.channel === "ONLINE") {
      const refusal = purchaseError({ status: event.salesStatus, isMember: member, banned: buyer.banned, kickoffAt: event.kickoffAt });
      if (refusal) return { error: refusal };
    } else {
      if (buyer.banned) return { error: "Ce Fan ID fait l'objet d'une interdiction de stade." };
      if (event.salesStatus === "CANCELLED" || event.salesStatus === "DRAFT") return { error: "La vente n'est pas ouverte pour ce match." };
    }

    const holders = [`${buyer.firstName} ${buyer.lastName}`, ...req.extraHolders.map((h) => h.trim())];
    if (holders.slice(1).some((h) => h.length < 3)) return { error: "Indiquez le nom de chaque porteur de billet supplémentaire." };

    // Plafond par Fan ID et par match (RG-10), invitations comprises.
    const [{ held }] = await tx
      .select({ held: sql<number>`count(*)::int` })
      .from(tickets)
      .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
      .where(and(eq(tickets.eventId, event.id), eq(ticketOrders.supporterId, buyer.id), inArray(tickets.status, [...HOLDING])));
    const cap = capError(held, holders.length, event.maxTicketsPerFan);
    if (cap) return { error: cap };

    const [{ taken }] = await tx
      .select({ taken: sql<number>`count(*)::int` })
      .from(tickets)
      .where(and(eq(tickets.categoryId, category.id), inArray(tickets.status, [...HOLDING])));
    if (taken + holders.length > category.capacity) {
      const left = Math.max(0, category.capacity - taken);
      return { error: left === 0 ? `Tribune « ${category.name} » complète.` : `Il ne reste que ${left} place(s) en « ${category.name} ».` };
    }

    const price = req.channel === "INVITATION" ? 0 : unitPrice(category, member);
    const immediate = req.channel !== "ONLINE";
    const reference = `CMD-${randomBytes(4).toString("hex").toUpperCase()}`;
    const [order] = await tx
      .insert(ticketOrders)
      .values({
        reference,
        eventId: event.id,
        supporterId: buyer.id,
        channel: req.channel,
        status: immediate ? "PAID" : "PENDING",
        total: price * holders.length,
        expiresAt: immediate ? null : new Date(Date.now() + RESERVATION_MINUTES * 60_000),
        soldBy: req.soldBy,
        paidAt: immediate ? new Date() : null,
      })
      .returning({ id: ticketOrders.id, total: ticketOrders.total });
    for (const [i, holderName] of holders.entries()) {
      const [{ n }] = await tx.execute<{ n: string }>(sql`select nextval(${sql.raw(`'${ticketNumberSeq.seqName}'`)}) as n`);
      await tx.insert(tickets).values({
        number: formatTicketNumber(Number(n)),
        orderId: order.id,
        eventId: event.id,
        categoryId: category.id,
        holderName,
        holderSupporterId: i === 0 ? buyer.id : null,
        price,
        token: randomToken(),
        status: immediate ? "VALID" : "RESERVED",
      });
    }
    return { orderId: order.id, reference, total: order.total };
  });
}

async function isActiveMemberTx(tx: Tx, supporterId: number) {
  const [m] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.supporterId, supporterId), eq(memberships.season, seasonOf()), eq(memberships.status, "ACTIVE")))
    .limit(1);
  return Boolean(m);
}

/** Paiement confirmé : commande payée, billets valides (appelé dans la transaction du paiement). */
export async function markOrderPaid(tx: Tx, orderId: number): Promise<void> {
  const updated = await tx
    .update(ticketOrders)
    .set({ status: "PAID", paidAt: new Date(), expiresAt: null })
    .where(and(eq(ticketOrders.id, orderId), eq(ticketOrders.status, "PENDING")))
    .returning({ id: ticketOrders.id });
  if (updated.length === 0) throw new Error("La commande n'est plus en attente de paiement (délai dépassé ?).");
  await tx.update(tickets).set({ status: "VALID" }).where(and(eq(tickets.orderId, orderId), eq(tickets.status, "RESERVED")));
}

/** Remboursement (EF-BIL-09) : billets annulés, places remises en vente. Impossible si un billet a servi. */
export async function refundOrder(orderId: number, userId: number): Promise<{ ok: true } | { error: string }> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(ticketOrders).where(eq(ticketOrders.id, orderId)).for("update").limit(1);
    if (!order || order.status !== "PAID") return { error: "Seule une commande payée peut être remboursée." };
    const [used] = await tx.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.orderId, orderId), eq(tickets.status, "USED"))).limit(1);
    if (used) return { error: "Un billet de cette commande a déjà servi à l'entrée : remboursement impossible." };
    await tx.update(ticketOrders).set({ status: "REFUNDED", refundedAt: new Date(), refundedBy: userId }).where(eq(ticketOrders.id, orderId));
    await tx.update(tickets).set({ status: "CANCELLED" }).where(eq(tickets.orderId, orderId));
    // En production : demande de remboursement à l'opérateur Mobile Money (M16).
    await tx
      .update(payments)
      .set({ status: "REFUNDED" })
      .where(and(eq(payments.purpose, "TICKET_ORDER"), eq(payments.targetId, orderId), eq(payments.status, "SUCCEEDED")));
    return { ok: true as const };
  });
}

export type ScanResult =
  | { ok: true; ticket: { number: string; holderName: string; category: string; gate: string } }
  | { ok: false; reason: ScanRefusal; detail?: string };

/**
 * Contrôle d'un billet à l'entrée (EF-CTL-01 à 03). Le passage est une mise à jour conditionnelle
 * (VALID → USED) : deux portes qui lisent le même billet au même instant ne l'acceptent qu'une fois.
 */
export async function scanTicket(eventId: number, token: string | null, gate: string, userId: number | null, at: Date = new Date()): Promise<ScanResult> {
  const [row] = token
    ? await db
        .select({ ticket: tickets, banned: supporters.banned, category: ticketCategories.name, catGate: ticketCategories.gate, points: ticketEvents.attendancePoints })
        .from(tickets)
        .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
        .innerJoin(supporters, eq(ticketOrders.supporterId, supporters.id))
        .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
        .innerJoin(ticketEvents, eq(tickets.eventId, ticketEvents.id))
        .where(eq(tickets.token, token))
        .limit(1)
    : [];

  const refuse = async (reason: ScanRefusal, detail?: string): Promise<ScanResult> => {
    await db.insert(scanRefusalsTable).values({ eventId, reason, ticketId: row?.ticket.id ?? null, gate, scannedBy: userId, createdAt: at });
    return { ok: false, reason, detail };
  };

  // Pas un billet : peut-être un badge presse (entrées multiples, EF-CTL-04).
  if (!row && token) {
    const [badge] = await db.select().from(accreditations).where(eq(accreditations.badgeToken, token)).limit(1);
    if (badge) {
      if (badge.eventId !== eventId) return refuse("OTHER_EVENT");
      if (badge.status !== "APPROVED") return refuse("BADGE_NOT_APPROVED");
      await db
        .update(accreditations)
        .set({ entries: sql`${accreditations.entries} + 1`, lastEntryAt: at })
        .where(eq(accreditations.id, badge.id));
      return { ok: true, ticket: badgeView(badge) };
    }
  }

  const refusal = scanRefusal(row ? { eventId: row.ticket.eventId, status: row.ticket.status, holderBanned: row.banned } : null, eventId);
  if (refusal) {
    const detail = refusal === "ALREADY_USED" && row?.ticket.usedAt ? `Entrée enregistrée à ${row.ticket.usedAt.toISOString()} (${row.ticket.usedGate ?? "porte ?"})` : undefined;
    return refuse(refusal, detail);
  }

  const passed = await db
    .update(tickets)
    .set({ status: "USED", usedAt: at, usedGate: gate, scannedBy: userId })
    .where(and(eq(tickets.id, row!.ticket.id), eq(tickets.status, "VALID")))
    .returning({ id: tickets.id });
  if (passed.length === 0) return refuse("ALREADY_USED", "Accepté à l'instant à une autre porte.");

  // Points de fidélité du match fréquenté (RG-15), une fois par supporter et par match.
  if (row!.ticket.holderSupporterId && row!.points > 0) {
    await db
      .insert(supporterPoints)
      .values({ supporterId: row!.ticket.holderSupporterId, points: row!.points, reason: "ATTENDANCE", refId: eventId })
      .onConflictDoNothing();
  }
  return { ok: true, ticket: { number: row!.ticket.number, holderName: row!.ticket.holderName, category: row!.category, gate: row!.catGate } };
}


const badgeView = (b: { number: string; firstName: string; lastName: string; outlet: string; grantedZones: string[] | null }) => ({
  number: b.number,
  holderName: `${b.firstName} ${b.lastName} — ${b.outlet}`,
  category: `Presse : ${(b.grantedZones ?? []).map((z) => PRESS_ZONE_LABELS[z as PressZone]).join(", ")}`,
  gate: "Accès presse",
});

/** Liste préchargée pour le contrôle hors ligne (EF-CTL-06) : empreintes des jetons, jamais les jetons. */
export async function offlineTicketList(eventId: number) {
  const badges = await db.select().from(accreditations).where(and(eq(accreditations.eventId, eventId), eq(accreditations.status, "APPROVED")));
  const badgeEntries = badges.map((b) => {
    const v = badgeView(b);
    return { h: createHash("sha256").update(b.badgeToken).digest("hex"), number: v.number, holder: v.holderName, category: v.category, gate: v.gate, status: "VALID" as const, banned: false, badge: true };
  });
  return [...(await offlineTickets(eventId)), ...badgeEntries];
}

async function offlineTickets(eventId: number) {
  const rows = await db
    .select({
      token: tickets.token,
      number: tickets.number,
      holder: tickets.holderName,
      status: tickets.status,
      category: ticketCategories.name,
      gate: ticketCategories.gate,
      banned: supporters.banned,
    })
    .from(tickets)
    .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
    .innerJoin(supporters, eq(ticketOrders.supporterId, supporters.id))
    .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .where(and(eq(tickets.eventId, eventId), inArray(tickets.status, ["VALID", "USED"])));
  return rows.map(({ token, ...t }) => ({ ...t, h: createHash("sha256").update(token).digest("hex"), status: t.status as "VALID" | "USED" }));
}
