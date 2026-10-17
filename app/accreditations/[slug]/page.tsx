import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { requestDeadline } from "@/lib/accreditations";
import { formatDateTime } from "@/lib/format";
import { openForAccreditation } from "@/lib/queries/accreditations";
import { requestAccreditation } from "../actions";
import { RequestForm } from "../RequestForm";

export const metadata: Metadata = { title: "Demande d'accréditation — FECOFOOT" };

/** Demande d'accréditation en ligne (EF-MED-01). */
export default async function AccreditationRequestPage({ params }: PageProps<"/accreditations/[slug]">) {
  const { slug } = await params;
  const event = (await openForAccreditation()).find((e) => e.slug === slug);
  if (!event) notFound();
  return (
    <PublicShell eyebrow="Accréditation presse" title={event.title}>
      <p className="mb-6 text-sm">
        {formatDateTime(event.kickoffAt)} · {event.venue} · demandes jusqu&apos;au {formatDateTime(requestDeadline(event.kickoffAt))}
      </p>
      <RequestForm action={requestAccreditation.bind(null, event.id)} />
    </PublicShell>
  );
}
