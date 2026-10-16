"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { passwordPolicyError } from "@/lib/auth/password";
import { ROLES, ROLES_MANAGED_ELSEWHERE, scopeError } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());

const UserSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide." }).trim().toLowerCase(),
  fullName: z.string().trim().min(3, { error: "Nom complet requis." }).max(160),
  phone: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(32).nullable()),
  role: z.enum(ROLES, { error: "Profil invalide." }),
  leagueId: optionalId,
  clubId: optionalId,
});

function parseUser(formData: FormData) {
  const parsed = UserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: fromZodError(parsed.error) } as const;
  // Seul le rattachement correspondant au profil est conservé.
  const data = {
    ...parsed.data,
    leagueId: parsed.data.role === "LEAGUE" ? parsed.data.leagueId : null,
    clubId: parsed.data.role === "CLUB" ? parsed.data.clubId : null,
  };
  if (ROLES_MANAGED_ELSEWHERE.includes(data.role)) return { error: { error: "Les comptes d'arbitre se créent depuis la fiche de l'arbitre." } satisfies ActionState } as const;
  const scope = scopeError(data);
  if (scope) return { error: { error: scope } satisfies ActionState } as const;
  return { data } as const;
}

async function emailTaken(email: string, exceptId?: number) {
  const where = exceptId ? and(eq(users.email, email), ne(users.id, exceptId)) : eq(users.email, email);
  const [row] = await db.select({ id: users.id }).from(users).where(where).limit(1);
  return Boolean(row);
}

export async function createUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.manage");
  const result = parseUser(formData);
  if ("error" in result) return result.error;

  const password = String(formData.get("password") ?? "");
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy, fieldErrors: { password: [policy] } };
  if (await emailTaken(result.data.email)) return { error: "Un compte existe déjà avec cette adresse e-mail." };

  const [created] = await db
    .insert(users)
    .values({ ...result.data, passwordHash: await bcrypt.hash(password, 12) })
    .returning({ id: users.id });

  await logAudit({
    userId: admin.id,
    action: "CREATE",
    entity: "user",
    entityId: created.id,
    details: { email: result.data.email, role: result.data.role },
  });
  revalidatePath("/admin/utilisateurs");
  redirect(`/admin/utilisateurs/${created.id}`);
}

export async function updateUser(userId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.manage");
  const result = parseUser(formData);
  if ("error" in result) return result.error;
  if (userId === admin.id && result.data.role !== "SUPER_ADMIN") {
    return { error: "Vous ne pouvez pas retirer votre propre profil de super administrateur." };
  }
  if (await emailTaken(result.data.email, userId)) return { error: "Un compte existe déjà avec cette adresse e-mail." };

  await db
    .update(users)
    .set({ ...result.data, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "UPDATE", entity: "user", entityId: userId, details: { role: result.data.role } });
  revalidatePath("/admin/utilisateurs");
  return { success: "Compte mis à jour." };
}

export async function setUserActive(userId: number, active: boolean): Promise<void> {
  const admin = await requirePermission("users.manage");
  if (userId === admin.id && !active) return;
  await db
    .update(users)
    .set({ active, updatedAt: new Date(), ...(!active && { sessionVersion: sql`${users.sessionVersion} + 1` }) })
    .where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: active ? "ACTIVATE" : "DEACTIVATE", entity: "user", entityId: userId });
  revalidatePath("/admin/utilisateurs");
  revalidatePath(`/admin/utilisateurs/${userId}`);
}

export async function unlockUser(userId: number): Promise<void> {
  const admin = await requirePermission("users.manage");
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "UNLOCK", entity: "user", entityId: userId });
  revalidatePath(`/admin/utilisateurs/${userId}`);
}

export async function resetUserPassword(userId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission("users.manage");
  const password = String(formData.get("password") ?? "");
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy };

  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(password, 12),
      failedLoginCount: 0,
      lockedUntil: null,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "RESET_PASSWORD", entity: "user", entityId: userId });
  return { success: "Mot de passe réinitialisé. Communiquez-le à l'utilisateur par un canal sûr." };
}

/** Perte du téléphone : le super administrateur désactive la double authentification (réactivation à la connexion suivante). */
export async function resetUserTwoFactor(userId: number): Promise<void> {
  const admin = await requirePermission("users.manage");
  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
  await logAudit({ userId: admin.id, action: "TWO_FACTOR_RESET", entity: "user", entityId: userId });
  revalidatePath(`/admin/utilisateurs/${userId}`);
}
