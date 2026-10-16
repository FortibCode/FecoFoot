"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { passwordPolicyError } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Changement de mot de passe par l'utilisateur (EF-AUT-04) : les autres sessions sont fermées. */
export async function changeOwnPassword(_state: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy };

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, me.id)).limit(1);
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  if (await bcrypt.compare(password, row.passwordHash)) return { error: "Le nouveau mot de passe doit être différent de l'actuel." };

  const [updated] = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(password, 12), sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, me.id))
    .returning({ sessionVersion: users.sessionVersion });
  // La session courante reste ouverte ; les autres (autres appareils) sont invalidées.
  await createSession(me.id, updated.sessionVersion);
  await logAudit({ userId: me.id, action: "PASSWORD_CHANGE", entity: "user", entityId: me.id });
  return { success: "Mot de passe modifié. Vos autres sessions ont été fermées." };
}
