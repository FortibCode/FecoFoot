import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { scopedClubOptions } from "@/lib/queries/reference";
import { createTransfer } from "../actions";
import { TransferForm } from "../TransferForm";

export const metadata: Metadata = { title: "Nouvelle demande de transfert — FECOFOOT" };

export default async function NewTransferPage({ searchParams }: PageProps<"/admin/transferts/nouveau">) {
  const user = await requirePermission("transfers.review");
  const clubs = await scopedClubOptions(user);
  const raw = (await searchParams).joueur;

  return (
    <>
      <PageHeader
        eyebrow="Licences · Transferts"
        title="Nouvelle demande de transfert"
        description="Un seul transfert en cours par joueur. À l'approbation, sa licence de la saison est close et le club d'accueil dépose une nouvelle demande."
      />
      <TransferForm action={createTransfer} clubs={clubs} federalId={Array.isArray(raw) ? raw[0] : raw} />
    </>
  );
}
