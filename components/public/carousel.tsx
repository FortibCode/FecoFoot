"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rangée de cartes qui défile à l'horizontale (doigt, molette, clavier), avec boutons précédent / suivant.
 * Défilement natif avec points d'arrêt : rien n'est caché derrière du JavaScript.
 * `heading` (titre, lien) s'aligne sur la même ligne que les boutons.
 */
export function Carousel({ label, children, tone = "dark", heading }: { label: string; children: ReactNode; tone?: "light" | "dark"; heading?: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = () => {
    const t = track.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 });
  };
  // Bornes recalculées dès l'affichage et à chaque redimensionnement (une seule carte : boutons masqués).
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
    // Défilement doux, sauf si l'appareil demande de réduire les animations.
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollBy({ left: dir * ((card?.clientWidth ?? 300) + 16), behavior: smooth ? "smooth" : "auto" });
  };
  const btn =
    tone === "dark"
      ? "border-white/40 text-white enabled:hover:bg-white enabled:hover:text-brand-ink disabled:border-white/15 disabled:text-white/30"
      : "border-foreground/25 bg-card text-foreground shadow-sm enabled:hover:border-foreground enabled:hover:bg-foreground enabled:hover:text-background disabled:border-foreground/10 disabled:bg-transparent disabled:text-foreground/30 disabled:shadow-none";
  const scrollable = !(edges.start && edges.end);

  return (
    <div className="flex flex-col gap-5">
      {(heading || scrollable) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">{heading}</div>
          {/* Tout tient à l'écran : pas de boutons. */}
          {scrollable && (
            <div className="flex gap-2">
              {([-1, 1] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => go(dir)}
                  disabled={dir === -1 ? edges.start : edges.end}
                  aria-label={dir === -1 ? `${label} : précédent` : `${label} : suivant`}
                  className={`flex size-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${btn}`}
                >
                  <svg viewBox="0 0 16 16" className={`size-4 ${dir === -1 ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Rangée bloquée à la verticale ; marge intérieure pour que l'ombre et le contour de focus ne soient pas rognés. */}
      <ul
        ref={track}
        onScroll={update}
        aria-label={label}
        className="-mx-4 -my-2 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scroll-px-4 px-4 py-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {children}
      </ul>
    </div>
  );
}
