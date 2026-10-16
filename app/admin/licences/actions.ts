"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { licenses } from "@/lib/db/schema";
import { isMinor, seasonLabel, transition, type LicenseAction } from "@/lib/licenses";
import { notify } from "@/lib/notify";
import { loadLicenseFor, validConsentExists } from "@/lib/queries/players";

const REASON_REQUIRED: LicenseAction[] = ["reject", "suspend"];

/** Encaissement, validation, rejet, suspension, réactivation d'une licence (EF-LIC-05, EF-LIC-06). */
export async function applyLicenseAction(
  licenseId: number,
  action: LicenseAction,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("licenses.validate");
  const row = await loadLicenseFor(user, licenseId);
  if (!row) return { error: "Licence introuvable." };
  const { license } = row;

  const reason = z.string().trim().max(500).safeParse(formData.get("reason") ?? "").data ?? "";
  if (REASON_REQUIRED.includes(action) && reason.length < 3) return { error: "Indiquez le motif." };
  const paymentRef = z.string().trim().max(64).safeParse(formData.get("paymentRef") ?? "").data ?? "";

  const result = transition(license.status, action, {
    hasValidConsent: action === "validate" ? await validConsentExists(license.playerId, license.clubId) : true,
    expired: Date.now() > license.expiresAt.getTime(),
  });
  if ("error" in result) return { error: result.error };

  const now = new Date();
  const changes: Partial<typeof licenses.$inferInsert> = { status: result.to, updatedAt: now };
  if (action === "pay") Object.assign(changes, { paidAt: now, paymentRef: paymentRef || null });
  if (action === "validate") Object.assign(changes, { validatedAt: now, validatedBy: user.id });
  if (REASON_REQUIRED.includes(action)) changes.decisionReason = reason;

  // Mise à jour conditionnelle : échoue si un autre utilisateur a changé le statut entre-temps.
  const updated = await db
    .update(licenses)
    .set(changes)
    .where(and(eq(licenses.id, licenseId), eq(licenses.status, license.status)))
    .returning({ id: licenses.id });
  if (updated.length === 0) return { error: "La licence vient d'être modifiée par un autre utilisateur. Rechargez la page." };

  await logAudit({
    userId: user.id,
    action: `LICENSE_${action.toUpperCase()}`,
    entity: "license",
    entityId: licenseId,
    details: { from: license.status, to: result.to, ...(reason && { reason }), ...(paymentRef && { paymentRef }) },
  });
  if (action === "validate") {
    // Avis de validation au joueur, ou à son représentant légal s'il est mineur (EF-NOT-01).
    const { player, club } = row;
    const minor = isMinor(player.birthDate);
    const text = `FECOFOOT : la licence ${license.number} de ${player.firstName} ${player.lastName} (${club.name}, saison ${seasonLabel(license.season)}) est validée.`;
    await notify(minor ? { phone: player.guardianPhone, email: player.guardianEmail } : { phone: player.phone, email: player.email }, {
      topic: "license_validated",
      subject: `FECOFOOT — licence ${license.number} validée`,
      sms: text,
      email: `${text}\n\nFédération Congolaise de Football`,
    });
  }
  revalidatePath(`/admin/licences/${licenseId}`);
  revalidatePath("/admin/licences");
  revalidatePath(`/admin/joueurs/${license.playerId}`);
  return { success: "Licence mise à jour." };
}
