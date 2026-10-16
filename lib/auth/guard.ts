import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { can, type Permission } from "./roles";
import { twoFactorRequired } from "./totp";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * Utilisateur connecté, relu en base à chaque requête : un compte désactivé ou dont le
 * mot de passe a changé perd l'accès immédiatement, même si son cookie est encore valide.
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      leagueId: users.leagueId,
      clubId: users.clubId,
      active: users.active,
      sessionVersion: users.sessionVersion,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  // Compte désactivé, ou mot de passe changé depuis l'ouverture de la session : accès refusé.
  return user && user.active && user.sessionVersion === session.sessionVersion ? user : null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export const TWO_FACTOR_SETUP_PATH = "/admin/mon-compte/double-authentification";

/**
 * À appeler en tête de chaque page et Server Action protégée (ENF-11).
 * Un profil soumis à la double authentification qui ne l'a pas encore activée
 * est renvoyé vers la page d'activation (seule page qui passe `allowTwoFactorSetup`).
 */
export async function requireUser(opts: { allowTwoFactorSetup?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!opts.allowTwoFactorSetup && !user.totpEnabledAt && twoFactorRequired(user.role)) redirect(TWO_FACTOR_SETUP_PATH);
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/admin/acces-refuse");
  return user;
}

/** Autorise l'utilisateur s'il possède au moins un des droits demandés. */
export async function requireAnyPermission(...permissions: Permission[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!permissions.some((p) => can(user.role, p))) redirect("/admin/acces-refuse");
  return user;
}
