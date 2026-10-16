import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { PasswordForm } from "@/components/ui/password-form";
import { resetPassword } from "./actions";

export const metadata: Metadata = { title: "Nouveau mot de passe — FECOFOOT", robots: { index: false } };

export default async function ResetPasswordPage({ params }: PageProps<"/reinitialiser/[token]">) {
  const { token } = await params;
  return (
    <PublicShell eyebrow="Espace fédéral" title="Choisir un nouveau mot de passe">
      <PasswordForm action={resetPassword.bind(null, token)} submitLabel="Enregistrer le mot de passe" loginLinkOnSuccess />
    </PublicShell>
  );
}
