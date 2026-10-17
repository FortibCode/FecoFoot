import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";
import { FanLoginForm } from "../SupporterForms";

export const metadata: Metadata = { title: "Connexion supporter — FECOFOOT" };

export default async function FanLoginPage() {
  if (await getCurrentSupporter()) redirect("/supporters/espace");
  return (
    <PublicShell eyebrow="Supporters" title="Connexion">
      <FanLoginForm />
      <Link href="/supporters/inscription" className="mt-6 inline-block text-sm underline">
        Créer mon Fan ID
      </Link>
    </PublicShell>
  );
}
