import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { PasswordForm } from "@/components/ui/password-form";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { changeOwnPassword } from "./actions";

export const metadata: Metadata = { title: "Mon compte — FECOFOOT" };

export default async function MyAccountPage() {
  const me = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Mon compte" title={me.fullName} description={`${me.email} · ${ROLE_LABELS[me.role]}`} />
      <h2 className="mb-3 font-semibold">Changer mon mot de passe</h2>
      <PasswordForm action={changeOwnPassword} askCurrent submitLabel="Changer le mot de passe" />
      <h2 className="mt-10 mb-3 font-semibold">Double authentification</h2>
      <Link href="/admin/mon-compte/double-authentification" className="text-sm underline">
        {me.totpEnabledAt ? "Activée — gérer" : "Non activée — activer"}
      </Link>
    </>
  );
}
