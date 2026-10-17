"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rangée de cartes qui défile à l'horizontale (doigt, molette, clavier), avec boutons précédent / suivant.
 * Défilement natif avec points d'arrêt : rien n'est caché derrière du JavaScript.
 */
export function Carousel({ label, children, tone = "dark" }: { label: string; children: ReactNode; tone?: "light" | "dark" }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = () => {
    const t = track.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 });
  };
  // Bornes recalculées dès l'affichage et à chaque redimensionnement (une seule carte : boutons désactivés).
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const ro = new ResizeObserver(() => update());
    ro.observe(t);
    return () => ro.disconnect();
  }, []);
  const go = (dir: 1 | -1) => {
    const t = track.current;
    if (!t) return;
    const card = t.querySelector("li");
    t.scrollBy({ left: dir * ((card?.clientWidth ?? 300) + 16), behavior: "smooth" });
  };
  const btn =
    tone === "dark"
      ? "border-white/30 text-white enabled:hover:bg-white enabled:hover:text-brand-ink"
      : "border-foreground/20 text-foreground enabled:hover:bg-foreground enabled:hover:text-background";

  return (
    <div className="flex flex-col gap-5">
      {/* Tout tient à l'écran : pas de boutons. */}
      <div className={`justify-end gap-2 ${edges.start && edges.end ? "hidden" : "flex"}`}>
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => go(dir)}
            disabled={dir === -1 ? edges.start : edges.end}
            aria-label={dir === -1 ? `${label} : précédent` : `${label} : suivant`}
            className={`flex size-10 items-center justify-center rounded-md border transition-colors disabled:opacity-35 ${btn}`}
          >
            <svg viewBox="0 0 16 16" className={`size-4 ${dir === -1 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        ))}
      </div>
      <ul
        ref={track}
        onScroll={update}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {children}
      </ul>
    </div>
  );
}
