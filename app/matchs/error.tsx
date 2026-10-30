"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PublicShell } from "@/components/public/public-shell";

/** Incident pendant le chargement (base indisponible…) : message clair et nouvelle tentative. */
export default function MatchesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PublicShell eyebrow="Matchs" title="Matchs et résultats" wide>
      <div role="alert" className="flex flex-col items-center gap-4 bg-muted/60 p-10 text-center">
        <p className="font-semibold">Les matchs n&apos;ont pas pu être chargés.</p>
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
