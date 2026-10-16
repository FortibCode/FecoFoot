import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Espace fédéral — Connexion" };

export default async function ConnexionPage() {
  if (await getCurrentUser()) redirect("/admin");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 h-1.5 w-full bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">FECOFOOT</p>
        <h1 className="mt-1 mb-6 text-2xl font-bold">Espace fédéral</h1>
        <LoginForm />
        <Link href="/mot-de-passe-oublie" className="mt-4 inline-block text-sm underline">
          Mot de passe oublié ?
        </Link>
      </div>
    </main>
  );
}
