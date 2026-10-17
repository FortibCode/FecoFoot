import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { requestDeadline } from "@/lib/accreditations";
import { formatDateTime } from "@/lib/format";
import { openForAccreditation } from "@/lib/queries/accreditations";

export const metadata: Metadata = { title: "Accréditations médias — FECOFOOT", description: "Demande d'accréditation presse pour les matchs de la FECOFOOT." };

export default async function AccreditationsPage() {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const events = await openForAccreditation();
  return (
    <PublicShell eyebrow="Médias" title="Accréditations presse" wide>
      <p className="mb-6 text-sm text-muted-foreground">
        Une demande par match, au plus tard 24 h avant le coup d&apos;envoi. Le badge numérique (QR code) est délivré après validation par le service
        communication.
      </p>
      {events.length === 0 ? (
        <p className="text-muted-foreground">Aucun match ouvert aux demandes pour le moment.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/accreditations/${e.slug}`} className="block rounded-lg border p-4 hover:bg-muted">
                <p className="font-semibold">{e.title}</p>
                <p className="text-sm">
                  {formatDateTime(e.kickoffAt)} · {e.venue}
                </p>
                <p className="text-xs text-muted-foreground">Demandes jusqu&apos;au {formatDateTime(requestDeadline(e.kickoffAt))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
