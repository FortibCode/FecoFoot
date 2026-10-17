import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { SignupForm } from "../SupporterForms";

export const metadata: Metadata = { title: "Créer mon Fan ID — FECOFOOT" };

/** Création du Fan ID (EF-SUP-01). */
export default async function SignupPage() {
  if (await getCurrentSupporter()) redirect("/supporters/espace");
  return (
    <PublicShell eyebrow="Supporters" title="Créer mon Fan ID">
      <SignupForm />
      <Link href="/supporters/connexion" className="mt-6 inline-block text-sm underline">
        J&apos;ai déjà un Fan ID
      </Link>
    </PublicShell>
  );
}
