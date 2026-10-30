"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Rangée de cartes qui défile à l'horizontale (doigt, molette, clavier), avec boutons précédent / suivant.
 * Défilement natif avec points d'arrêt : rien n'est caché derrière du JavaScript.
 * `heading` (titre, lien) s'aligne sur la même ligne que les boutons.
 */
export function Carousel({ label, children, heading, autoplay }: { label: string; children: ReactNode; heading?: ReactNode; autoplay?: number }) {
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
  const scrollable = !(edges.start && edges.end);

  // Défilement automatique (`autoplay` ms) : une carte à la fois, retour au début en fin de rangée.
  // En pause au survol, au toucher, au clavier, onglet masqué, ou si l'appareil demande moins d'animations.
  const [hold, setHold] = useState(false);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!autoplay || hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const t = track.current;
      if (!t || document.visibilityState !== "visible") return;
      const card = t.querySelector("li");
      if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 4) t.scrollTo({ left: 0, behavior: "smooth" });
      else t.scrollBy({ left: (card?.clientWidth ?? 300) + 16, behavior: "smooth" });
    }, autoplay);
    return () => clearInterval(id);
  }, [autoplay, hold]);
  const pause = () => {
    clearTimeout(resume.current);
    setHold(true);
  };
  // Au toucher : reprise quelques secondes après (pas de « sortie de survol » sur téléphone).
  const pauseTouch = () => {
    pause();
    resume.current = setTimeout(() => setHold(false), 8000);
  };

  // Flèche du carrousel : rond vert du drapeau, flèche blanche ; au survol, fond jaune, flèche qui avance,
  // onde qui s'élargit. Animations seulement si l'appareil ne demande pas à les réduire.
  const arrow = (dir: 1 | -1) => (
    <button
      type="button"
      onClick={() => go(dir)}
      disabled={dir === -1 ? edges.start : edges.end}
      aria-label={dir === -1 ? `${label} : précédent` : `${label} : suivant`}
      className="group/arrow relative grid size-11 shrink-0 place-items-center rounded-full bg-[var(--flag-green)] text-white shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--flag-green)_70%,transparent)] transition-[background-color,color,transform,box-shadow] duration-300 ease-out hover:bg-[var(--flag-yellow)] hover:text-brand-ink hover:shadow-[0_10px_24px_-6px_color-mix(in_srgb,var(--flag-yellow)_80%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--flag-green)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none motion-safe:hover:scale-110 motion-safe:active:scale-95 sm:size-14"
    >
      {/* Onde au survol */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[var(--flag-green)] opacity-0 group-disabled/arrow:hidden motion-safe:transition-[transform,opacity] motion-safe:duration-500 motion-safe:group-hover/arrow:scale-150 motion-safe:group-hover/arrow:opacity-0 group-hover/arrow:opacity-40"
      />
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`size-5 transition-transform duration-300 ease-out sm:size-6 ${dir === -1 ? "rotate-180 motion-safe:group-hover/arrow:-translate-x-1" : "motion-safe:group-hover/arrow:translate-x-1"} group-disabled/arrow:translate-x-0`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {heading && <div className="min-w-0">{heading}</div>}
      {/* Flèches à l'extérieur de la rangée, centrées en hauteur : précédent à gauche, suivant à droite (grisées aux extrémités). */}
      <div
        className="flex items-center gap-2 sm:gap-4"
        onPointerEnter={(e) => e.pointerType === "mouse" && pause()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHold(false)}
        onTouchStart={pauseTouch}
        onFocus={pause}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
        }}
      >
        {scrollable && arrow(-1)}
        <ul
          ref={track}
          onScroll={update}
          aria-label={label}
          className="-my-2 flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden py-2 [scrollbar-width:none]"
        >
          {children}
        </ul>
        {scrollable && arrow(1)}
      </div>
    </div>
  );
}
