import "server-only";
import { and, count, desc, eq, gte, ilike, lt, or, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, supporters, ticketOrders, users } from "@/lib/db/schema";
import { normalizeCongoPhone } from "@/lib/supporters";
import { PAYMENT_METHODS, PAYMENT_PURPOSES, PAYMENT_STATUSES, type PaymentMethod, type PaymentPurpose, type PaymentStatus } from "@/lib/payments-rules";

export type PaymentFilters = { purpose?: PaymentPurpose; status?: PaymentStatus; method?: PaymentMethod; from?: string; to?: string; q?: string };

const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);
const pick = <T extends string>(list: readonly T[], v?: string) => (list as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

/** Filtres de la page et de l'export (mêmes paramètres). */
export function paymentFilters(get: (k: string) => string | string[] | null | undefined): PaymentFilters {
  return {
    purpose: pick(PAYMENT_PURPOSES, one(get("objet"))),
    status: pick(PAYMENT_STATUSES, one(get("etat"))),
    method: pick(PAYMENT_METHODS, one(get("moyen"))),
    from: isDay(one(get("du"))),
    to: isDay(one(get("au"))),
    q: one(get("q"))?.slice(0, 60),
  };
}

export function paymentQueryString(f: PaymentFilters): URLSearchParams {
  const q = new URLSearchParams();
  const map = { purpose: "objet", status: "etat", method: "moyen", from: "du", to: "au", q: "q" } as const;
  for (const [k, name] of Object.entries(map)) {
    const v = f[k as keyof PaymentFilters];
    if (v) q.set(name, v);
  }
  return q;
}

/** Période en jours entiers à l'heure de Brazzaville (UTC+1), « au » inclus. */
function where(f: PaymentFilters, { withStatus = true } = {}): SQL | undefined {
  const c: SQL[] = [];
  if (f.purpose) c.push(eq(payments.purpose, f.purpose));
  if (withStatus && f.status) c.push(eq(payments.status, f.status));
  if (f.method) c.push(eq(payments.method, f.method));
  if (f.from) c.push(gte(payments.createdAt, new Date(`${f.from}T00:00:00+01:00`)));
  if (f.to) c.push(lt(payments.createdAt, new Date(new Date(`${f.to}T00:00:00+01:00`).getTime() + 86_400_000)));
  if (f.q) {
    const phone = normalizeCongoPhone(f.q);
    c.push(or(ilike(payments.reference, `%${f.q}%`), ilike(payments.providerRef, `%${f.q}%`), ...(phone ? [eq(payments.phone, phone)] : []))!);
  }
  return c.length ? and(...c) : undefined;
}

const rowSelect = {
  p: payments,
  fanId: supporters.fanId,
  fanName: sql<string | null>`${supporters.firstName} || ' ' || ${supporters.lastName}`,
  userName: users.fullName,
  eventId: ticketOrders.eventId,
};

function rowsQuery(f: PaymentFilters) {
  return db
    .select(rowSelect)
    .from(payments)
    .leftJoin(supporters, eq(payments.supporterId, supporters.id))
    .leftJoin(users, eq(payments.userId, users.id))
    .leftJoin(ticketOrders, and(eq(payments.purpose, "TICKET_ORDER"), eq(ticketOrders.id, payments.targetId)))
    .where(where(f))
    .orderBy(desc(payments.createdAt), desc(payments.id))
    .$dynamic();
}

export type PaymentRow = Awaited<ReturnType<ReturnType<typeof rowsQuery>["execute"]>>[number];

export async function listPayments(f: PaymentFilters, page: number, pageSize: number) {
  const [rows, [{ total }]] = await Promise.all([
    rowsQuery(f).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(payments).where(where(f)),
  ]);
  return { rows, total };
}

export const exportPayments = (f: PaymentFilters, max: number) => rowsQuery(f).limit(max);

/** Synthèse sur la période et les filtres (hors filtre d'état : on veut voir tous les états). */
export async function paymentSummary(f: PaymentFilters) {
  const base = where(f, { withStatus: false });
  const [byStatus, byPurpose, byMethod] = await Promise.all([
    db.select({ status: payments.status, n: count(), amount: sum(payments.amount) }).from(payments).where(base).groupBy(payments.status),
    db
      .select({ purpose: payments.purpose, n: count(), amount: sum(payments.amount) })
      .from(payments)
      .where(and(base, eq(payments.status, "SUCCEEDED")))
      .groupBy(payments.purpose),
    db
      .select({ method: payments.method, n: count(), amount: sum(payments.amount) })
      .from(payments)
      .where(and(base, eq(payments.status, "SUCCEEDED")))
      .groupBy(payments.method),
  ]);
  const num = (v: string | number | null) => Number(v ?? 0);
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, { n: r.n, amount: num(r.amount) }])) as Partial<Record<PaymentStatus, { n: number; amount: number }>>,
    byPurpose: byPurpose.map((r) => ({ purpose: r.purpose, n: r.n, amount: num(r.amount) })),
    byMethod: byMethod.map((r) => ({ method: r.method, n: r.n, amount: num(r.amount) })),
  };
}

/** Lien vers ce qui a été payé, dans l'espace fédéral. */
export function paymentTargetHref(r: PaymentRow): string | null {
  switch (r.p.purpose) {
    case "MEMBERSHIP":
      return r.p.supporterId ? `/admin/supporters/${r.p.supporterId}` : null;
    case "TICKET_ORDER":
      return r.eventId ? `/admin/billetterie/${r.eventId}` : null;
    case "LICENSE_FEE":
      return `/admin/licences/${r.p.targetId}`;
  }
}

export const payerLabel = (r: PaymentRow) => (r.fanId ? `${r.fanName} (${r.fanId})` : r.userName ?? "Guichet");
