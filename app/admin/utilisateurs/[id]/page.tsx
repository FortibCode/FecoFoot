import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { isLocked } from "@/lib/auth/lockout";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { clubOptions, leagueOptions } from "@/lib/queries/reference";
import { resetUserPassword, resetUserTwoFactor, setUserActive, unlockUser, updateUser } from "../actions";
import { ResetPasswordForm, UserForm } from "../UserForm";

export const metadata: Metadata = { title: "Compte utilisateur — FECOFOOT" };

export default async function UserPage({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  const admin = await requirePermission("users.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [[user], leagues, clubs] = await Promise.all([
    db.select().from(users).where(eq(users.id, id)).limit(1),
    leagueOptions(),
    clubOptions(),
  ]);
  if (!user) notFound();

  const locked = isLocked(user.lockedUntil);
  const isSelf = user.id === admin.id;

  return (
    <>
      <PageHeader
        eyebrow="Administration · Utilisateurs"
        title={user.fullName}
        description={`Créé le ${formatDateTime(user.createdAt)} · dernière connexion : ${formatDateTime(user.lastLoginAt)}`}
      />

      <div className="flex flex-col gap-10">
        <div id="modifier">
        <UserForm
          action={updateUser.bind(null, user.id)}
          leagues={leagues}
          clubs={clubs}
          initial={user}
          submitLabel="Enregistrer"
        />
        </div>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Accès</h2>
          <p className="text-sm text-muted-foreground">
            État : {!user.active ? "désactivé" : locked ? `verrouillé jusqu'au ${formatDateTime(user.lockedUntil)}` : "actif"} · double
            authentification : {user.totpEnabledAt ? `activée le ${formatDateTime(user.totpEnabledAt)}` : "non activée"}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isSelf && (
              <form action={setUserActive.bind(null, user.id, !user.active)}>
                <Button type="submit" variant={user.active ? "destructive" : "outline"} className="h-10">
                  {user.active ? "Désactiver le compte" : "Réactiver le compte"}
                </Button>
              </form>
            )}
            {user.totpEnabledAt && (
              <form action={resetUserTwoFactor.bind(null, user.id)}>
                <Button type="submit" variant="outline" className="h-10">
                  Réinitialiser la double authentification
                </Button>
              </form>
            )}
            {locked && (
              <form action={unlockUser.bind(null, user.id)}>
                <Button type="submit" variant="outline" className="h-10">
                  Déverrouiller
                </Button>
              </form>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Mot de passe</h2>
          <ResetPasswordForm action={resetUserPassword.bind(null, user.id)} />
        </section>
      </div>
    </>
  );
}
