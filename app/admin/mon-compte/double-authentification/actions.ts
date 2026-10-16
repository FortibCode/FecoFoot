"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser, TWO_FACTOR_SETUP_PATH } from "@/lib/auth/guard";
import { createSession } from "@/lib/auth/session";
import { newTotpSecret, twoFactorRequired, verifyTotp } from "@/lib/auth/totp";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Étape 1 : génère un nouveau secret (pas encore actif). */
export async function startTwoFactorSetup(): Promise<void> {
  const me = await requireUser({ allowTwoFactorSetup: true });
  if (me.totpEnabledAt) return;
  await db.update(users).set({ totpSecret: encryptSecret(newTotpSecret()), totpLastStep: null }).where(eq(users.id, me.id));
  revalidatePath(TWO_FACTOR_SETUP_PATH);
}

/** Étape 2 : l'utilisateur prouve que son application affiche le bon code ; la protection est activée. */
export async function confirmTwoFactorSetup(_state: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser({ allowTwoFactorSetup: true });
  const [row] = await db.select({ secret: users.totpSecret, enabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!row?.secret || row.enabledAt) return { error: "Recommencez l'activation." };

  const step = verifyTotp(decryptSecret(row.secret), String(formData.get("code") ?? ""));
  if (step === null) return { error: "Code incorrect. Vérifiez l'heure de votre téléphone et saisissez le code affiché actuellement." };

  // Les autres sessions (ouvertes sans second facteur) sont fermées ; celle-ci est renouvelée.
  const [updated] = await db
    .update(users)
    .set({ totpEnabledAt: new Date(), totpLastStep: step, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, me.id))
    .returning({ sessionVersion: users.sessionVersion });
  await createSession(me.id, updated.sessionVersion);
  await logAudit({ userId: me.id, action: "TWO_FACTOR_ENABLED", entity: "user", entityId: me.id });
  revalidatePath(TWO_FACTOR_SETUP_PATH);
  return { success: "Double authentification activée." };
}

/** Désactivation par l'utilisateur (impossible pour les profils où elle est obligatoire). */
export async function disableTwoFactor(_state: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (twoFactorRequired(me.role)) return { error: "La double authentification est obligatoire pour votre profil." };
  const [row] = await db.select({ secret: users.totpSecret, lastStep: users.totpLastStep }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!row?.secret || verifyTotp(decryptSecret(row.secret), String(formData.get("code") ?? ""), { lastStep: row.lastStep }) === null) {
    return { error: "Code incorrect." };
  }
  await db.update(users).set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null }).where(eq(users.id, me.id));
  await logAudit({ userId: me.id, action: "TWO_FACTOR_DISABLED", entity: "user", entityId: me.id });
  revalidatePath(TWO_FACTOR_SETUP_PATH);
  return { success: "Double authentification désactivée." };
}
