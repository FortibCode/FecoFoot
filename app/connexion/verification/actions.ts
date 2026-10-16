"use server";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { createSession, deletePendingTwoFactor, readPendingTwoFactor } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hitRateLimit } from "@/lib/rate-limit";

export type VerifyState = { error?: string } | undefined;

/** Second facteur : code à 6 chiffres de l'application d'authentification (EF-AUT-05). */
export async function verifyTwoFactor(_state: VerifyState, formData: FormData): Promise<VerifyState> {
  const pending = await readPendingTwoFactor();
  if (!pending) redirect("/connexion");

  // 5 essais par étape de connexion ; au-delà, retour à la saisie du mot de passe.
  const rl = await hitRateLimit(`2fa:${pending.userId}`, 5, 5 * 60_000);
  if (!rl.allowed) {
    await deletePendingTwoFactor();
    await logAudit({ userId: pending.userId, action: "LOGIN_2FA_BLOCKED", entity: "user", entityId: pending.userId });
    redirect("/connexion");
  }

  const [user] = await db.select().from(users).where(eq(users.id, pending.userId)).limit(1);
  if (!user || !user.active || !user.totpSecret || !user.totpEnabledAt || user.sessionVersion !== pending.sessionVersion) {
    await deletePendingTwoFactor();
    redirect("/connexion");
  }

  const step = verifyTotp(decryptSecret(user.totpSecret), String(formData.get("code") ?? ""), { lastStep: user.totpLastStep });
  if (step === null) {
    await logAudit({ userId: user.id, action: "LOGIN_2FA_FAILED", entity: "user", entityId: user.id });
    return { error: "Code incorrect ou expiré. Saisissez le code affiché actuellement par l'application." };
  }

  // Enregistrement conditionnel du pas : un même code ne peut pas servir deux fois, même en parallèle.
  const updated = await db
    .update(users)
    .set({ totpLastStep: step, failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(and(eq(users.id, user.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
    .returning({ id: users.id });
  if (updated.length === 0) return { error: "Ce code a déjà été utilisé. Attendez le suivant." };

  await deletePendingTwoFactor();
  await logAudit({ userId: user.id, action: "LOGIN", entity: "user", entityId: user.id, details: { twoFactor: true } });
  await createSession(user.id, user.sessionVersion);
  redirect("/admin");
}
