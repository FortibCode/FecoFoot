"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PublicShell } from "@/components/public/public-shell";

/** Incident pendant le chargement (base indisponible…) : message clair et nouvelle tentative. */
export default function CompetitionsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PublicShell eyebrow="Compétitions" title="Compétitions" wide>
      <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center">
        <p className="font-semibold">Les compétitions n&apos;ont pas pu être chargées.</p>
        <p className="text-sm text-muted-foreground">Le service est momentanément indisponible. Réessayez dans un instant.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => retry()} className="h-10 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white">
            Réessayer
          </button>
          <Link href="/" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold hover:bg-muted">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
