import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Espace fédéral — Connexion" };

export default async function ConnexionPage() {
  if (await getCurrentUser()) redirect("/admin");

  return (
    <AuthLayout title="Connexion">
      <LoginForm />
    </AuthLayout>
  );
}
