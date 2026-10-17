import "server-only";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { requestDeadline } from "@/lib/accreditations";
import { db } from "@/lib/db";
import { accreditations, ticketEvents } from "@/lib/db/schema";
import { hashToken } from "@/lib/tokens";

/** Matchs ouverts aux demandes : publiés, non annulés, coup d'envoi dans plus de 24 h. */
export async function openForAccreditation() {
  const rows = await db
    .select()
    .from(ticketEvents)
    .where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN", "CLOSED"]), gt(ticketEvents.kickoffAt, new Date())))
    .orderBy(asc(ticketEvents.kickoffAt));
  return rows.filter((e) => requestDeadline(e.kickoffAt).getTime() > Date.now());
}

export async function accreditationByTracking(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ acc: accreditations, event: ticketEvents })
    .from(accreditations)
    .innerJoin(ticketEvents, eq(accreditations.eventId, ticketEvents.id))
    .where(eq(accreditations.trackingHash, hashToken(token)))
    .limit(1);
  return row ?? null;
}

export async function accreditationByBadge(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ acc: accreditations, event: ticketEvents })
    .from(accreditations)
    .innerJoin(ticketEvents, eq(accreditations.eventId, ticketEvents.id))
    .where(eq(accreditations.badgeToken, token))
    .limit(1);
  return row ?? null;
}
