"use server";

import bcrypt from "bcryptjs";
import { and, eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { blockedMessage, deleteTicketEventRecord, ticketEventBlockers } from "@/lib/deletion";
import { fanIdSeq, supporters, ticketCategories, ticketEvents, tickets } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { isUniqueViolation } from "@/lib/queries/players";
import { nextVal } from "@/lib/sequences";
import { formatFanId, ID_DOCUMENT_LABELS, ID_DOCUMENT_TYPES, normalizeCongoPhone } from "@/lib/supporters";
import { createOrder, refundOrder, scanTicket, type ScanResult } from "@/lib/ticket-sales";
import { EVENT_KINDS, SALES_STATUSES, ticketTokenFrom } from "@/lib/ticketing";
import { randomToken } from "@/lib/tokens";

const eventPath = (id: number) => `/admin/billetterie/${id}`;

const EventSchema = z.object({
  title: z.string().trim().min(5, { error: "Intitulé requis." }).max(200),
  kind: z.enum(EVENT_KINDS),
  venue: z.string().trim().min(3, { error: "Stade requis." }).max(160),
  kickoffAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "Date et heure requises." }),
  maxTicketsPerFan: z.coerce.number().int().min(1).max(20),
  attendancePoints: z.coerce.number().int().min(0).max(100),
  gateFlowLimit: z.coerce.number().int().min(1).max(1000),
});

/** Création d'un événement en vente (EF-BIL-01). */
export async function createTicketEvent(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const parsed = EventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const e = parsed.data;
  const kickoffAt = new Date(`${e.kickoffAt}:00+01:00`);
  const base = slugify(`${e.title} ${e.kickoffAt.slice(0, 10)}`);
  const taken = new Set((await db.select({ slug: ticketEvents.slug }).from(ticketEvents).where(like(ticketEvents.slug, `${base}%`))).map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const [created] = await db.insert(ticketEvents).values({ ...e, kickoffAt, slug }).returning({ id: ticketEvents.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "ticket_event", entityId: created.id, details: { title: e.title } });
  redirect(eventPath(created.id));
}

/** Cycle de vente : brouillon → prévente membres → vente ouverte → clôturée / annulée (EF-BIL-03). */
export async function setSalesStatus(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const status = z.enum(SALES_STATUSES).safeParse(formData.get("status"));
  if (!status.success) return { error: "Statut invalide." };
  const n = await db.$count(ticketCategories, eq(ticketCategories.eventId, eventId));
  if ((status.data === "PRESALE" || status.data === "OPEN") && n === 0) return { error: "Ajoutez au moins une tribune avant d'ouvrir la vente." };
  await db.update(ticketEvents).set({ salesStatus: status.data }).where(eq(ticketEvents.id, eventId));
  await logAudit({ userId: user.id, action: "SALES_STATUS", entity: "ticket_event", entityId: eventId, details: { to: status.data } });
  revalidatePath(eventPath(eventId));
  revalidatePath("/billetterie", "layout");
  return { success: "Statut de vente mis à jour." };
}

/** Tribune : prix public, prix membre, capacité, porte (EF-BIL-02). */
export async function addCategory(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const parsed = z
    .object({
      name: z.string().trim().min(2, { error: "Nom de la tribune requis." }).max(80),
      gate: z.string().trim().min(1, { error: "Porte d'accès requise." }).max(40),
      capacity: z.coerce.number({ error: "Capacité requise." }).int().min(1, { error: "Capacité requise." }).max(100_000),
      publicPrice: z.coerce.number({ error: "Prix requis." }).int().min(0).max(10_000_000),
      memberPrice: z.coerce.number({ error: "Prix membre requis." }).int().min(0).max(10_000_000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [cat] = await db.insert(ticketCategories).values({ ...parsed.data, eventId }).returning({ id: ticketCategories.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "ticket_category", entityId: cat.id, details: { eventId, ...parsed.data } });
  revalidatePath(eventPath(eventId));
  return { success: "Tribune ajoutée." };
}

const NewFanSchema = z.object({
  lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
  firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
  birthDate: z.iso.date({ error: "Date de naissance invalide." }),
  idDocumentType: z.enum(ID_DOCUMENT_TYPES),
  idDocumentNumber: z.string().trim().toUpperCase().min(4, { error: "Numéro de pièce requis." }).max(40),
});

/**
 * Vente au guichet (espèces) ou invitation (EF-BIL-08) : Fan ID existant retrouvé par téléphone,
 * ou créé sur présentation de la pièce d'identité (vérifiée par l'agent).
 */
export async function counterSale(eventId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const phone = normalizeCongoPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Numéro de téléphone congolais invalide." };
  const channel = formData.get("channel") === "INVITATION" ? "INVITATION" : "COUNTER";

  let [fan] = await db.select().from(supporters).where(eq(supporters.phone, phone)).limit(1);
  if (!fan) {
    const parsed = NewFanSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: `Aucun Fan ID pour ce numéro : renseignez l'identité pour le créer. ${parsed.error.issues[0]?.message ?? ""}` };
    try {
      [fan] = await db
        .insert(supporters)
        .values({
          ...parsed.data,
          lastName: parsed.data.lastName.toUpperCase(),
          birthDate: new Date(`${parsed.data.birthDate}T00:00:00Z`),
          fanId: formatFanId(await nextVal(fanIdSeq)),
          phone,
          // Mot de passe inconnu : le supporter pourra créer son accès en ligne plus tard.
          passwordHash: await bcrypt.hash(randomToken(), 10),
          consentAt: new Date(),
          idVerifiedAt: new Date(),
          createdBy: user.id,
        })
        .returning();
    } catch (e) {
      if (isUniqueViolation(e, "supporters_id_document_uq")) return { error: "Cette pièce d'identité est déjà rattachée à un autre Fan ID." };
      throw e;
    }
    await logAudit({ userId: user.id, action: "FAN_ID_CREATED", entity: "supporter", entityId: fan.id, details: { fanId: fan.fanId, counter: true } });
  } else if (!fan.idVerifiedAt) {
    // Premier achat d'un Fan ID créé en ligne : l'agent vérifie la pièce d'identité (EF-SUP-08).
    if (formData.get("idChecked") !== "on") {
      return { error: `Premier achat de ce Fan ID : vérifiez la pièce d'identité (${ID_DOCUMENT_LABELS[fan.idDocumentType]} n° ${fan.idDocumentNumber}) et cochez la case.` };
    }
    await db.update(supporters).set({ idVerifiedAt: new Date() }).where(eq(supporters.id, fan.id));
    await logAudit({ userId: user.id, action: "ID_VERIFIED", entity: "supporter", entityId: fan.id, details: { counter: true } });
  }

  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { error: "Nombre de billets invalide." };
  const extraHolders = Array.from({ length: quantity - 1 }, (_, i) => String(formData.get(`holder_${i + 1}`) ?? ""));
  const order = await createOrder({ eventId, categoryId: Number(formData.get("categoryId")), supporterId: fan.id, extraHolders, channel, soldBy: user.id });
  if ("error" in order) return { error: order.error };

  await logAudit({ userId: user.id, action: channel === "INVITATION" ? "INVITATION" : "COUNTER_SALE", entity: "ticket_order", entityId: order.orderId, details: { eventId, total: order.total, fanId: fan.fanId } });
  revalidatePath(eventPath(eventId));
  return { success: `${channel === "INVITATION" ? "Invitation" : "Vente"} enregistrée : commande ${order.reference}, Fan ID ${fan.fanId}, ${order.total} FCFA.` };
}

/** Remboursement d'une commande (EF-BIL-09). */
export async function refundTicketOrder(eventId: number, orderId: number): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const result = await refundOrder(orderId, user.id);
  if ("error" in result) return { error: result.error };
  await logAudit({ userId: user.id, action: "REFUND", entity: "ticket_order", entityId: orderId, details: { eventId } });
  revalidatePath(eventPath(eventId));
  return { success: "Commande remboursée : places remises en vente." };
}

export type ScanState = (ScanResult & { at: string; entries: number }) | undefined;

/** Contrôle d'accès : lecture d'un billet à une porte (M12). */
export async function scanAtGate(eventId: number, _state: ScanState, formData: FormData): Promise<ScanState> {
  const user = await requirePermission("ticketing.manage");
  const gate = z.preprocess(blankToNull, z.string().trim().max(40).nullable()).parse(formData.get("gate")) ?? "—";
  const result = await scanTicket(eventId, ticketTokenFrom(String(formData.get("code") ?? "")), gate, user.id);
  // Compteur d'entrées en temps réel (EF-CTL-05).
  const entries = await db.$count(tickets, and(eq(tickets.eventId, eventId), eq(tickets.status, "USED")));
  return { ...result, at: new Date().toISOString(), entries };
}

const OfflineScansSchema = z
  .array(z.object({ token: z.string().max(200), gate: z.string().max(40), at: z.iso.datetime() }))
  .max(50_000);

export type SyncState = { accepted: number; conflicts: { code: string; reason: string }[] } | { error: string };

/**
 * Synchronisation des passages enregistrés hors ligne (EF-CTL-06), dans l'ordre chronologique et à leur heure réelle.
 * Un billet passé hors ligne à deux portes n'est accepté qu'une fois : l'autre passage est signalé comme conflit.
 */
export async function syncOfflineScans(eventId: number, scans: unknown): Promise<SyncState> {
  const user = await requirePermission("ticketing.manage");
  const parsed = OfflineScansSchema.safeParse(scans);
  if (!parsed.success) return { error: "Données de synchronisation invalides." };
  const ordered = [...parsed.data].sort((a, b) => a.at.localeCompare(b.at));
  let accepted = 0;
  const conflicts: { code: string; reason: string }[] = [];
  for (const s of ordered) {
    const r = await scanTicket(eventId, ticketTokenFrom(s.token), s.gate || "—", user.id, new Date(s.at));
    if (r.ok) accepted++;
    else conflicts.push({ code: s.token.slice(-8), reason: r.reason });
  }
  await logAudit({ userId: user.id, action: "OFFLINE_SYNC", entity: "ticket_event", entityId: eventId, details: { scans: ordered.length, accepted, conflicts: conflicts.length } });
  revalidatePath(eventPath(eventId));
  return { accepted, conflicts };
}

/** Suppression d'un événement sans aucune vente ni demande d'accréditation (sinon : annuler la vente). */
export async function deleteTicketEvent(eventId: number): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const reasons = await ticketEventBlockers(eventId);
  if (reasons.length) return { error: `${blockedMessage("L'événement", reasons)} Passez plutôt sa vente à « Annulée ».` };
  await deleteTicketEventRecord(eventId);
  await logAudit({ userId: user.id, action: "DELETE", entity: "ticket_event", entityId: eventId });
  revalidatePath("/admin/billetterie");
  revalidatePath("/billetterie", "layout");
  return { success: "Événement supprimé." };
}
