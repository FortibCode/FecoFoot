"use client";

import { useEffect } from "react";

/**
 * Section principale au défilement : chaque section marquée `data-focus` reçoit la variable CSS --focus
 * (0 à 1) selon la place qu'elle occupe à l'écran. La section qu'on lit est en pleine lumière et à taille
 * normale ; les autres s'estompent et reculent légèrement, au fil du défilement (globals.css).
 * Rien ne change si l'appareil demande moins d'animations.
 */
export function SectionFocus() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-focus]")];
    if (sections.length === 0) return;
    root.classList.add("focus-ready");
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        // Pleine lumière dès qu'elle occupe 60 % de l'écran (ou qu'elle est entière, si elle est courte).
        const focus = Math.min(1, visible / Math.min(r.height, vh * 0.6));
        s.style.setProperty("--focus", focus.toFixed(3));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.classList.remove("focus-ready");
      for (const s of sections) s.style.removeProperty("--focus");
    };
  }, []);
  return null;
}
