import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readPendingTwoFactor } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth-layout";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Vérification en deux étapes — FECOFOOT", robots: { index: false } };

export default async function TwoFactorPage() {
  if (!(await readPendingTwoFactor())) redirect("/connexion");
  return (
    <AuthLayout title="Vérification en deux étapes" intro="Saisissez le code affiché par votre application d'authentification.">
      <VerifyForm />
      <Link href="/connexion" className="mt-4 inline-block text-sm text-primary underline">
        Revenir à la connexion
      </Link>
    </AuthLayout>
  );
}
