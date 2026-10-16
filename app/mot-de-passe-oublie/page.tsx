import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Mot de passe oublié — FECOFOOT", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <PublicShell eyebrow="Espace fédéral" title="Mot de passe oublié">
      <ForgotForm />
      <Link href="/connexion" className="mt-6 inline-block text-sm underline">
        Retour à la connexion
      </Link>
    </PublicShell>
  );
}
