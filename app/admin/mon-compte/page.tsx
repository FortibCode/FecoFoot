import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { PasswordForm } from "@/components/ui/password-form";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { changeOwnPassword } from "./actions";

export const metadata: Metadata = { title: "Mon compte — FECOFOOT" };

/** Profil, mot de passe et double authentification du compte connecté. */
export default async function MyAccountPage() {
  const me = await requireUser();
  const initials = me.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <>
      <PageHeader eyebrow="Mon compte" title="Mon compte" description="Vos informations et la sécurité de votre accès à l'espace fédéral." />
      <div className="account-grid">
        <section className="account-profile" aria-label="Profil">
          <span className="account-avatar" aria-hidden>
            {initials}
          </span>
          <p className="account-name">{me.fullName}</p>
          <p className="account-role">{ROLE_LABELS[me.role]}</p>
          <dl className="account-facts">
            <div>
              <dt>E-mail</dt>
              <dd>{me.email}</dd>
            </div>
            <div>
              <dt>Double authentification</dt>
              <dd>
                <StatusBadge tone={me.totpEnabledAt ? "ok" : "wait"}>{me.totpEnabledAt ? "Activée" : "Non activée"}</StatusBadge>
              </dd>
            </div>
            {me.totpEnabledAt && (
              <div>
                <dt>Activée le</dt>
                <dd>{formatDateTime(me.totpEnabledAt)}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-4">
            <h2>Changer mon mot de passe</h2>
            <PasswordForm action={changeOwnPassword} askCurrent submitLabel="Changer le mot de passe" />
          </section>
          <section className="flex flex-col gap-4">
            <h2>Double authentification</h2>
            <div className="account-2fa">
              <p>
                {me.totpEnabledAt
                  ? "Votre compte est protégé : un code à 6 chiffres de votre application d'authentification est demandé à chaque connexion."
                  : "Ajoutez une seconde protection : en plus du mot de passe, un code à 6 chiffres généré par une application (Google Authenticator, Microsoft Authenticator…) sera demandé à la connexion."}
              </p>
              <Link href="/admin/mon-compte/double-authentification" className={`admin-btn ${me.totpEnabledAt ? "admin-btn-outline" : "admin-btn-primary"}`}>
                {me.totpEnabledAt ? "Gérer la double authentification" : "Activer la double authentification"}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
