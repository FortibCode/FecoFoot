"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { logAudit } from "@/lib/audit";
import { isLocked, registerFailure } from "@/lib/auth/lockout";
import { createPendingTwoFactor, createSession, deleteSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hitRateLimit, LIMITS, peekRateLimit, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

const LoginSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Mot de passe requis." }),
});

export type LoginState = { error?: string; email?: string } | undefined;

const INVALID = "E-mail ou mot de passe incorrect.";

// Hachage factice : la comparaison prend le même temps que l'e-mail existe ou non.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("fecofoot-dummy-password", 12));

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? INVALID, email };

  // Limitation par adresse IP (ENF-13) : complète le verrouillage par compte (EF-AUT-06).
  // Seuls les échecs sont comptés : les connexions réussies d'un bureau partagé ne bloquent personne.
  const ipKey = `login-fail:${await clientIp()}`;
  const { limit, windowMs } = LIMITS.loginFailuresPerIp;
  const failure = () => hitRateLimit(ipKey, limit, windowMs);
  const probe = await peekRateLimit(ipKey, limit, windowMs);
  if (!probe.allowed) return { error: retryMessage(probe.retryAfterSec), email };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);

  if (!user) {
    await failure();
    await bcrypt.compare(parsed.data.password, getDummyHash());
    await logAudit({ userId: null, action: "LOGIN_FAILED", entity: "user", details: { email: parsed.data.email } });
    return { error: INVALID, email };
  }

  if (isLocked(user.lockedUntil)) {
    await logAudit({ userId: user.id, action: "LOGIN_LOCKED", entity: "user", entityId: user.id });
    return { error: "Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.", email };
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok || !user.active) {
    await failure();
    const next = registerFailure(user.failedLoginCount);
    await db.update(users).set(next).where(eq(users.id, user.id));
    await logAudit({
      userId: user.id,
      action: next.lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
      entity: "user",
      entityId: user.id,
    });
    return { error: INVALID, email };
  }

  if (user.totpEnabledAt) {
    // Mot de passe correct : reste à saisir le code de l'application (EF-AUT-05).
    await createPendingTwoFactor(user.id, user.sessionVersion);
    await logAudit({ userId: user.id, action: "LOGIN_PASSWORD_OK", entity: "user", entityId: user.id });
    redirect("/connexion/verification");
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await logAudit({ userId: user.id, action: "LOGIN", entity: "user", entityId: user.id });
  await createSession(user.id, user.sessionVersion);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await logAudit({ userId: user.id, action: "LOGOUT", entity: "user", entityId: user.id });
  await deleteSession();
  redirect("/connexion");
}
