import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { otpauthUri, twoFactorRequired } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { confirmTwoFactorSetup, disableTwoFactor, startTwoFactorSetup } from "./actions";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "Double authentification — FECOFOOT" };

/** Activation de la double authentification par application (EF-AUT-05). */
export default async function TwoFactorSetupPage() {
  const me = await requireUser({ allowTwoFactorSetup: true });
  const [row] = await db.select({ secret: users.totpSecret, enabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, me.id)).limit(1);
  const required = twoFactorRequired(me.role);
  const secret = row?.secret && !row.enabledAt ? decryptSecret(row.secret) : null;

  return (
    <>
      <PageHeader
        eyebrow="Mon compte"
        title="Double authentification"
        description="À chaque connexion, en plus du mot de passe, un code à 6 chiffres affiché par une application sur votre téléphone (Google Authenticator, Microsoft Authenticator, FreeOTP…)."
      />

      {row?.enabledAt ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm">Activée depuis le {formatDateTime(row.enabledAt)}.</p>
          {required ? (
            <p className="text-sm text-muted-foreground">
              Obligatoire pour votre profil. En cas de perte du téléphone, demandez au super administrateur de la réinitialiser.
            </p>
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Désactiver</h2>
              <CodeForm action={disableTwoFactor} submitLabel="Désactiver la double authentification" variant="destructive" />
            </section>
          )}
          <Link href="/admin" className="text-sm underline">
            Aller au tableau de bord
          </Link>
        </div>
      ) : secret ? (
        <ol className="flex max-w-xl list-decimal flex-col gap-6 pl-5 text-sm">
          <li>
            Dans l&apos;application, ajoutez un compte en scannant ce QR code :
            <div className="mt-3 w-44 rounded border bg-white p-2 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: await qrSvg(otpauthUri(secret, me.email)) }} />
            <p className="mt-2">
              ou saisissez la clé : <code className="break-all rounded bg-muted px-1 font-mono" data-testid="totp-secret">{secret}</code>
            </p>
          </li>
          <li>
            Saisissez le code affiché par l&apos;application pour confirmer :
            <div className="mt-3">
              <CodeForm action={confirmTwoFactorSetup} submitLabel="Activer" />
            </div>
          </li>
        </ol>
      ) : (
        <div className="flex flex-col gap-4">
          {required && (
            <p role="status" className="rounded-md bg-[color-mix(in_oklch,var(--flag-yellow)_30%,transparent)] px-3 py-2 text-sm">
              La double authentification est obligatoire pour votre profil : activez-la pour accéder à l&apos;espace fédéral.
            </p>
          )}
          <form action={startTwoFactorSetup}>
            <Button type="submit" className="h-10">
              Commencer l&apos;activation
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
