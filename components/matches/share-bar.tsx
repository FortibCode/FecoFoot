"use client";

import { useEffect, useRef, useState } from "react";
import { useFollowedClubs } from "@/components/matches/favorites";

const KEY = "fecofoot:clubs-suivis";

const btn =
  "grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green";

/**
 * Actions d'un match en icônes (suivre, partager, agenda), dans une pastille discrète.
 * Suivre : les clubs du match (mémorisés sur l'appareil). Partager : WhatsApp, Facebook ou lien copié
 * (partage du téléphone quand il existe). Agenda : fichier .ics du match à venir.
 */
export function ShareBar({ title, path, agenda, clubs = [] }: { title: string; path: string; agenda?: string | null; clubs?: number[] }) {
  const followed = useFollowedClubs();
  const following = clubs.length > 0 && clubs.every((id) => followed.includes(id));
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const url = () => `${window.location.origin}${path}`;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggleFollow = () => {
    try {
      const set = new Set(followed);
      for (const id of clubs) {
        if (following) set.delete(id);
        else set.add(id);
      }
      window.localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {
      // Stockage indisponible : rien à mémoriser.
    }
    window.dispatchEvent(new Event(KEY));
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: url() });
      } catch {
        // Partage annulé.
      }
      return;
    }
    setOpen((v) => !v);
  };

  const item = "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted";
  return (
    <div ref={root} role="group" aria-label="Actions du match" className="relative inline-flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-sm">
      {clubs.length > 0 && (
        <button type="button" onClick={toggleFollow} aria-pressed={following} aria-label={following ? "Ne plus suivre ce match" : "Suivre ce match (ses deux clubs)"} title={following ? "Suivi" : "Suivre"} className={btn}>
          <svg aria-hidden viewBox="0 0 24 24" className={`size-5 ${following ? "text-[var(--flag-yellow)]" : ""}`} fill={following ? "currentColor" : "none"} stroke={following ? "none" : "currentColor"} strokeWidth="1.8" strokeLinejoin="round">
            <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
        </button>
      )}
      <button type="button" onClick={share} aria-label="Partager ce match" aria-expanded={open} aria-haspopup="menu" title="Partager" className={btn}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      </button>
      {agenda && (
        <a href={agenda} download aria-label="Ajouter ce match à mon agenda" title="Ajouter à mon agenda" className={btn}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="14" height="14" rx="2" />
            <path d="M3.5 9.5h14M7.5 3v4M13.5 3v4M19 15v6M16 18h6" />
          </svg>
        </a>
      )}
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-2 w-48 rounded-xl border bg-card p-1 shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`, "_blank", "noopener,noreferrer")}>
            WhatsApp
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, "_blank", "noopener,noreferrer")}>
            Facebook
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url());
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                // Presse-papiers indisponible.
              }
            }}
          >
            {copied ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      )}
      <span role="status" className="sr-only">
        {copied ? "Lien copié dans le presse-papiers" : ""}
      </span>
    </div>
  );
}
