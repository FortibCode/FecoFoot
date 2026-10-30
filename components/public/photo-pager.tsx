"use client";

import { useRef, useState } from "react";
import { ChevronIcon } from "@/components/public/icons";

type Photo = { id: number; src: string; caption: string; credit: string | null; width: number; height: number };

const PER_PAGE = 5;

/**
 * Galerie en portrait, 5 photos par page : numéros de page et flèches précédente / suivante.
 * Légende au survol ; chaque photo s'ouvre en grand dans un nouvel onglet.
 */
export function PhotoPager({ photos }: { photos: Photo[] }) {
  const [page, setPage] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const pages = Math.ceil(photos.length / PER_PAGE);
  const shown = photos.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const go = (p: number) => {
    setPage(p);
    // Retour en haut de la galerie si elle sort de l'écran.
    if (top.current && top.current.getBoundingClientRect().top < 0) top.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const btn =
    "grid size-10 place-items-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green disabled:pointer-events-none disabled:opacity-40";
  return (
    <div ref={top} className="flex scroll-mt-28 flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
        {shown.map((p) => (
          <li key={p.id}>
            <figure className="group relative aspect-[3/4] overflow-hidden bg-muted">
              <a href={p.src} target="_blank" rel="noreferrer" className="block size-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green">
                {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                <img src={p.src} alt={p.caption} width={p.width} height={p.height} className="size-full object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
              </a>
              {p.caption && (
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-[linear-gradient(to_top,rgb(0_0_0/0.85),transparent)] px-3 pt-8 pb-3 text-xs text-white transition-transform duration-300 group-focus-within:translate-y-0 group-hover:translate-y-0">
                  {p.caption}
                  {p.credit && <span className="block text-white/70">© {p.credit}</span>}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages de la galerie" className="flex flex-wrap items-center justify-center gap-1.5">
          <button type="button" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Photos précédentes" className={`${btn} bg-muted/60 hover:bg-[var(--flag-green)] hover:text-white`}>
            <ChevronIcon dir="left" />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Page ${i + 1}`}
              aria-current={i === page ? "page" : undefined}
              className={`${btn} tabular-nums ${i === page ? "bg-brand-ink text-white" : "bg-muted/60 hover:bg-muted"}`}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" onClick={() => go(page + 1)} disabled={page === pages - 1} aria-label="Photos suivantes" className={`${btn} bg-muted/60 hover:bg-[var(--flag-green)] hover:text-white`}>
            <ChevronIcon />
          </button>
          <span className="w-full pt-1 text-center text-xs text-muted-foreground" aria-live="polite">
            Photos {page * PER_PAGE + 1} à {Math.min((page + 1) * PER_PAGE, photos.length)} sur {photos.length}
          </span>
        </nav>
      )}
    </div>
  );
}
