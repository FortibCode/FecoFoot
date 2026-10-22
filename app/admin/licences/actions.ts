"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { licenses, players } from "@/lib/db/schema";
import { DOCUMENT_TYPES, LICENSE_REQUIRED_DOCUMENTS } from "@/lib/documents";
import { isMinor, LICENSE_STATUS_LABELS, REASON_REQUIRED, resubmitStatus, seasonLabel, transition, type LicenseAction } from "@/lib/licenses";
import { notify } from "@/lib/notify";
import { hasDocuments } from "@/lib/queries/documents";
import { loadLicenseFor, validConsentExists } from "@/lib/queries/players";

function revalidateLicense(licenseId: number, playerId: number) {
  revalidatePath(`/admin/licences/${licenseId}`);
  revalidatePath("/admin/licences");
  revalidatePath(`/admin/joueurs/${playerId}`);
  revalidatePath("/admin/espace-joueur");
}

/**
 * Instruction d'une licence (EF-LIC-05, EF-LIC-06) : encaissement, validation, rejet, demande de corrections,
 * suspension, réactivation, révocation (fédération seulement). La validation exige l'accord en ligne, les
 * justificatifs obligatoires et le contrôle d'identité par l'agent, confirmé au moment de valider.
 */
export async function applyLicenseAction(
  licenseId: number,
  action: LicenseAction,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("licenses.validate");
  if (action === "revoke" && !can(user.role, "licenses.revoke")) return { error: "Seule la fédération peut révoquer une licence." };
  const row = await loadLicenseFor(user, licenseId);
  if (!row) return { error: "Licence introuvable." };
  const { license, player, club } = row;

  const reason = z.string().trim().max(500).safeParse(formData.get("reason") ?? "").data ?? "";
  if (REASON_REQUIRED.includes(action) && reason.length < 3) return { error: "Indiquez le motif." };
  const paymentRef = z.string().trim().max(64).safeParse(formData.get("paymentRef") ?? "").data ?? "";

  // Validation : justificatifs obligatoires et identité (déjà contrôlée, ou confirmée par l'agent maintenant).
  let missingDocuments: string[] = [];
  let confirmIdentity = false;
  if (action === "validate") {
    const docs = await hasDocuments("player", player.id, LICENSE_REQUIRED_DOCUMENTS);
    missingDocuments = LICENSE_REQUIRED_DOCUMENTS.filter((t) => !docs[t]).map((t) => DOCUMENT_TYPES[t].label);
    confirmIdentity = !player.identityVerifiedAt && formData.get("identityChecked") === "on";
  }
  const result = transition(license.status, action, {
    hasValidConsent: action === "validate" ? await validConsentExists(license.playerId, license.clubId) : true,
    expired: Date.now() > license.expiresAt.getTime(),
    missingDocuments,
    identityVerified: Boolean(player.identityVerifiedAt) || confirmIdentity,
  });
  if ("error" in result) return { error: result.error };

  const now = new Date();
  const changes: Partial<typeof licenses.$inferInsert> = { status: result.to, updatedAt: now };
  if (action === "pay") Object.assign(changes, { paidAt: now, paymentRef: paymentRef || null });
  if (action === "validate") Object.assign(changes, { validatedAt: now, validatedBy: user.id, decisionReason: null });
  if (REASON_REQUIRED.includes(action)) changes.decisionReason = reason;

  // Mise à jour conditionnelle : échoue si un autre utilisateur a changé le statut entre-temps.
  const updated = await db.transaction(async (tx) => {
    const done = await tx
      .update(licenses)
      .set(changes)
      .where(and(eq(licenses.id, licenseId), eq(licenses.status, license.status)))
      .returning({ id: licenses.id });
    if (done.length && confirmIdentity) {
      await tx.update(players).set({ identityVerifiedAt: now, identityVerifiedBy: user.id, identityMethod: "DOCUMENTS", updatedAt: now }).where(eq(players.id, player.id));
    }
    return done;
  });
  if (updated.length === 0) return { error: "La licence vient d'être modifiée par un autre utilisateur. Rechargez la page." };

  if (confirmIdentity) await logAudit({ userId: user.id, action: "IDENTITY_VERIFIED", entity: "player", entityId: player.id, details: { method: "DOCUMENTS", licenseId } });
  await logAudit({
    userId: user.id,
    action: `LICENSE_${action.toUpperCase()}`,
    entity: "license",
    entityId: licenseId,
    details: { from: license.status, to: result.to, ...(reason && { reason }), ...(paymentRef && { paymentRef }) },
  });

  // Avis : au joueur (ou à son représentant légal) pour une décision le concernant, au club pour un dossier à corriger.
  const minor = isMinor(player.birthDate);
  const playerContact = minor ? { phone: player.guardianPhone, email: player.guardianEmail } : { phone: player.phone, email: player.email };
  const who = `${player.firstName} ${player.lastName} (${club.name}, saison ${seasonLabel(license.season)})`;
  const messages: Partial<Record<LicenseAction, { to: { phone?: string | null; email?: string | null }; text: string }>> = {
    validate: { to: playerContact, text: `FECOFOOT : la licence ${license.number} de ${who} est validée.` },
    correct: { to: { phone: club.phone, email: club.email }, text: `FECOFOOT : le dossier de licence ${license.number} de ${who} est à corriger. Motif : ${reason}` },
    reject: { to: { phone: club.phone, email: club.email }, text: `FECOFOOT : la demande de licence ${license.number} de ${who} est rejetée. Motif : ${reason}` },
    suspend: { to: playerContact, text: `FECOFOOT : la licence ${license.number} de ${who} est suspendue. Motif : ${reason}` },
    revoke: { to: playerContact, text: `FECOFOOT : la licence ${license.number} de ${who} est révoquée. Motif : ${reason}` },
  };
  const m = messages[action];
  if (m) {
    const topic = { validate: "license_validated", correct: "license_correction", reject: "license_rejected", suspend: "license_suspended", revoke: "license_revoked" }[action as string];
    await notify(m.to, { topic: topic ?? `license_${action}`, subject: `FECOFOOT — licence ${license.number} : ${LICENSE_STATUS_LABELS[result.to].toLowerCase()}`, sms: m.text, email: `${m.text}\n\nFédération Congolaise de Football` });
  }
  revalidateLicense(licenseId, license.playerId);
  return { success: "Licence mise à jour." };
}

/** Nouvelle soumission par le club d'un dossier renvoyé pour corrections : il reprend au stade où il était. */
export async function resubmitLicense(licenseId: number): Promise<ActionState> {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const row = await loadLicenseFor(user, licenseId);
  if (!row) return { error: "Licence introuvable." };
  const { license } = row;
  if (license.status !== "TO_CORRECT") return { error: "Ce dossier n'est pas en attente de corrections." };
  const to = resubmitStatus(license.paidAt !== null);
  const updated = await db
    .update(licenses)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(licenses.id, licenseId), eq(licenses.status, "TO_CORRECT")))
    .returning({ id: licenses.id });
  if (updated.length === 0) return { error: "Le dossier vient d'être modifié. Rechargez la page." };
  await logAudit({ userId: user.id, action: "LICENSE_RESUBMIT", entity: "license", entityId: licenseId, details: { to, previousReason: license.decisionReason } });
  revalidateLicense(licenseId, license.playerId);
  return { success: "Dossier soumis à nouveau : il repart en instruction." };
}
