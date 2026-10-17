"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Animations d'apparition au défilement : tout élément marqué `data-reveal` (up, down, left, right, zoom)
 * entre en glissant quand il arrive à l'écran. Délai en cascade avec la variable CSS --rd.
 * Sans JavaScript, ou si l'appareil demande moins d'animations, le contenu s'affiche normalement.
 */
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    scan();
    // Contenus ajoutés après coup (navigation, actualisation des données).
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}
