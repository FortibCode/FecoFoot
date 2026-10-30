"use client";

import { useState } from "react";

/**
 * Partager une fiche de match (WhatsApp, Facebook, lien copié, partage du téléphone) et l'ajouter à
 * son agenda. Aucun service tiers n'est chargé : ce ne sont que des liens.
 */
export function ShareBar({ title, path, agenda }: { title: string; path: string; agenda?: string | null }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green";
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Partager ce match" role="group">
      {agenda && (
        <a href={agenda} download className={btn}>
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <rect x="2" y="3" width="12" height="11" rx="2" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
          </svg>
          Ajouter à mon agenda
        </a>
      )}
      <button type="button" className={btn} onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`)}>
        WhatsApp
      </button>
      <button type="button" className={btn} onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)}>
        Facebook
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title, url: url() });
            else {
              await navigator.clipboard.writeText(url());
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            }
          } catch {
            // Partage annulé par le visiteur : rien à faire.
          }
        }}
      >
        {copied ? "Lien copié" : "Partager le lien"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Lien copié dans le presse-papiers" : ""}
      </span>
    </div>
  );
}
