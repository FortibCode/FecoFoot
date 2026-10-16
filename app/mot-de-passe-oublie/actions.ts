"use server";

import { eq } from "drizzle-orm";
import * as z from "zod";
import { logAudit } from "@/lib/audit";
import { sendPasswordLink } from "@/lib/auth/reset-link";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hitRateLimit, LIMITS, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type ForgotState = { error?: string; success?: string } | undefined;

// Même réponse que le compte existe ou non : on ne révèle pas quelles adresses sont inscrites.
const SENT = "Si un compte actif correspond à cette adresse, un lien de réinitialisation vient d'être envoyé par e-mail (et par SMS si un numéro est enregistré). Il est valable 1 heure.";

/** Mot de passe oublié (EF-AUT-04). */
export async function requestPasswordReset(_state: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = z.email().trim().toLowerCase().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Adresse e-mail invalide." };
  const email = parsed.data;

  const perIp = await hitRateLimit(`reset-ip:${await clientIp()}`, LIMITS.passwordResetPerIp.limit, LIMITS.passwordResetPerIp.windowMs);
  if (!perIp.allowed) return { error: retryMessage(perIp.retryAfterSec) };
  // Au-delà de 3 demandes par heure pour une adresse, on répond sans renvoyer (pas de harcèlement par SMS).
  const perEmail = await hitRateLimit(`reset-email:${email}`, LIMITS.passwordResetPerEmail.limit, LIMITS.passwordResetPerEmail.windowMs);
  if (!perEmail.allowed) return { success: SENT };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.active) return { success: SENT };

  await sendPasswordLink(user, "reset");
  await logAudit({ userId: user.id, action: "PASSWORD_RESET_REQUEST", entity: "user", entityId: user.id });
  return { success: SENT };
}
