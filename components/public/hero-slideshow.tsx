"use client";

import { useEffect, useState } from "react";

export type Slide = { src: string; caption: string };

/** Durée d'affichage de chaque photo, et du fondu enchaîné. */
const INTERVAL_MS = 6000;
const FADE_MS = 1200;

/**
 * Photos « à la une » qui défilent en fondu enchaîné, avec un zoom lent (bandeau d'accueil).
 * Sans commandes visibles : le défilement s'arrête quand un élément du bandeau a le focus clavier, quand l'onglet est masqué, et ne démarre pas si l'appareil demande moins d'animations.
 * `background` : en fond du bandeau (tablette, ordinateur) ; `framed` : photo cadrée (téléphone).
 */
export function HeroSlideshow({ slides, variant, className = "" }: { slides: Slide[]; variant: "background" | "framed"; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const many = slides.length > 1;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Pause tant que le focus clavier est dans le bandeau (la section qui contient le diaporama).
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const zone = root?.closest("section");
    if (!zone) return;
    const stop = () => setPaused(true);
    const go = () => setPaused(false);
    const onFocusOut = (e: FocusEvent) => {
      if (!zone.contains(e.relatedTarget as Node | null)) go();
    };
    zone.addEventListener("focusin", stop);
    zone.addEventListener("focusout", onFocusOut);
    return () => {
      zone.removeEventListener("focusin", stop);
      zone.removeEventListener("focusout", onFocusOut);
    };
  }, [root]);

  useEffect(() => {
    if (!many || paused || reduced) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [many, paused, reduced, slides.length]);

  const framed = variant === "framed";
  return (
    <div ref={setRoot} className={`${framed ? "relative aspect-[4/3] overflow-hidden rounded-2xl" : "absolute inset-0"} ${className}`}>
      {slides.map((s, i) => {
        const active = i === index;
        return (
          // eslint-disable-next-line @next/next/no-img-element -- images servies par la route des médias
          <img
            key={s.src}
            src={s.src}
            alt={active ? s.caption : ""}
            aria-hidden={!active}
            fetchPriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 size-full object-cover object-[60%_30%]"
            style={{
              opacity: active ? 1 : 0,
              transform: reduced ? undefined : active ? "scale(1)" : "scale(1.08)",
              transition: reduced ? undefined : `opacity ${FADE_MS}ms ease-in-out, transform ${active ? INTERVAL_MS + FADE_MS : FADE_MS}ms ease-out`,
            }}
          />
        );
      })}
    </div>
  );
}
