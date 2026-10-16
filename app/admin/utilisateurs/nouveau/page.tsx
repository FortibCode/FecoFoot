import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { clubOptions, leagueOptions } from "@/lib/queries/reference";
import { createUser } from "../actions";
import { UserForm } from "../UserForm";

export const metadata: Metadata = { title: "Nouveau compte — FECOFOOT" };

export default async function NewUserPage() {
  await requirePermission("users.manage");
  const [leagues, clubs] = await Promise.all([leagueOptions(), clubOptions()]);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Nouveau compte" />
      <UserForm action={createUser} leagues={leagues} clubs={clubs} submitLabel="Créer le compte" />
    </>
  );
}
