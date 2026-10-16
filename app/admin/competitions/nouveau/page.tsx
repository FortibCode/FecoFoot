import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { seasonOf } from "@/lib/licenses";
import { createCompetition } from "../actions";
import { CompetitionForm } from "../CompetitionForms";

export const metadata: Metadata = { title: "Nouvelle compétition — FECOFOOT" };

export default async function NewCompetitionPage() {
  await requirePermission("competitions.manage");
  return (
    <>
      <PageHeader eyebrow="Sport · Compétitions" title="Nouvelle compétition" />
      <CompetitionForm action={createCompetition} season={seasonOf()} />
    </>
  );
}
