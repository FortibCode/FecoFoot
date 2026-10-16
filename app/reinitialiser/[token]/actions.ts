"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { passwordPolicyError } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { hashToken } from "@/lib/tokens";

export type ResetState = { error?: string; success?: string } | undefined;

/** Choix d'un nouveau mot de passe depuis le lien reçu (EF-AUT-04). */
export async function resetPassword(token: string, _state: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Les deux mots de passe ne correspondent pas." };
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy };

  const now = new Date();
  const hash = await bcrypt.hash(password, 12);
  const userId = await db.transaction(async (tx) => {
    // Consommation atomique du lien : il ne peut servir qu'une fois.
    const [reset] = await tx
      .update(passwordResets)
      .set({ usedAt: now })
      .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)))
      .returning({ userId: passwordResets.userId });
    if (!reset) return null;
    await tx
      .update(users)
      .set({
        passwordHash: hash,
        failedLoginCount: 0,
        lockedUntil: null,
        // Déconnecte toutes les sessions ouvertes avec l'ancien mot de passe.
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(and(eq(users.id, reset.userId), eq(users.active, true)));
    return reset.userId;
  });
  if (!userId) return { error: "Ce lien n'est plus valable (expiré ou déjà utilisé). Faites une nouvelle demande." };

  await logAudit({ userId, action: "PASSWORD_RESET", entity: "user", entityId: userId });
  return { success: "Votre mot de passe a été modifié. Vous pouvez vous connecter." };
}
