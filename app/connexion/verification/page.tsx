import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readPendingTwoFactor } from "@/lib/auth/session";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Vérification en deux étapes — FECOFOOT", robots: { index: false } };

export default async function TwoFactorPage() {
  if (!(await readPendingTwoFactor())) redirect("/connexion");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 h-1.5 w-full bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">FECOFOOT</p>
        <h1 className="mt-1 mb-2 text-2xl font-bold">Vérification en deux étapes</h1>
        <p className="mb-6 text-sm text-muted-foreground">Saisissez le code affiché par votre application d&apos;authentification.</p>
        <VerifyForm />
        <Link href="/connexion" className="mt-4 inline-block text-sm underline">
          Revenir à la connexion
        </Link>
      </div>
    </main>
  );
}
