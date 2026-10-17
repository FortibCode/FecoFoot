"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { membershipPlans, supporters } from "@/lib/db/schema";
import { saveSupporterPhoto } from "@/lib/supporter-photo";
import { MEMBERSHIP_TIERS } from "@/lib/supporters";

/** Interdiction de stade, motivée (EF-SUP-07, RG-14) : achat et accès refusés. */
export async function banSupporter(supporterId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Indiquez le motif de l'interdiction." };
  await db
    .update(supporters)
    .set({ banned: true, banReason: reason, bannedAt: new Date(), bannedBy: user.id, sessionVersion: sql`${supporters.sessionVersion} + 1` })
    .where(eq(supporters.id, supporterId));
  await logAudit({ userId: user.id, action: "STADIUM_BAN", entity: "supporter", entityId: supporterId, details: { reason } });
  revalidatePath(`/admin/supporters/${supporterId}`);
  return { success: "Interdiction de stade enregistrée." };
}

export async function liftBan(supporterId: number): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  await db.update(supporters).set({ banned: false, banReason: null, bannedAt: null, bannedBy: null }).where(eq(supporters.id, supporterId));
  await logAudit({ userId: user.id, action: "STADIUM_BAN_LIFTED", entity: "supporter", entityId: supporterId });
  revalidatePath(`/admin/supporters/${supporterId}`);
  return { success: "Interdiction levée." };
}

/** Pièce d'identité vérifiée sur présentation, photo comparée (guichet, premier achat — EF-SUP-08). */
export async function markIdVerified(supporterId: number): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const updated = await db
    .update(supporters)
    .set({ idVerifiedAt: new Date() })
    .where(and(eq(supporters.id, supporterId), isNotNull(supporters.photoKey)))
    .returning({ id: supporters.id });
  if (updated.length === 0) return { error: "Ajoutez d'abord la photo d'identité du supporter." };
  await logAudit({ userId: user.id, action: "ID_VERIFIED", entity: "supporter", entityId: supporterId });
  revalidatePath(`/admin/supporters/${supporterId}`);
  return { success: "Pièce d'identité vérifiée." };
}

/** Photo d'identité prise au guichet (EF-SUP-08). */
export async function uploadSupporterPhoto(supporterId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const result = await saveSupporterPhoto(supporterId, formData.get("file"));
  if ("error" in result) return { error: result.error };
  await logAudit({ userId: user.id, action: "SUPPORTER_PHOTO", entity: "supporter", entityId: supporterId, details: { by: "agent" } });
  revalidatePath(`/admin/supporters/${supporterId}`);
  return { success: "Photo enregistrée." };
}

/** Tarifs d'adhésion au club des supporters, par saison et par formule. */
export async function saveMembershipPlan(season: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ticketing.manage");
  const parsed = z
    .object({
      tier: z.enum(MEMBERSHIP_TIERS),
      price: z.coerce.number({ error: "Prix requis." }).int({ error: "Montant entier en FCFA." }).min(0).max(10_000_000),
      open: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { tier, price, open } = parsed.data;
  await db
    .insert(membershipPlans)
    .values({ season, tier, price, open })
    .onConflictDoUpdate({ target: [membershipPlans.season, membershipPlans.tier], set: { price, open } });
  await logAudit({ userId: user.id, action: "MEMBERSHIP_PLAN", entity: "membership_plan", entityId: `${season}-${tier}`, details: { price, open } });
  revalidatePath("/admin/supporters/adhesions");
  return { success: "Tarif enregistré." };
}

