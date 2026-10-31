"use client";

import { useEffect } from "react";

/**
 * Sections empilées au défilement (page d'accueil) : chaque section marquée `data-stack` reste en place une fois
 * entièrement lue, et la suivante glisse par-dessus pour la remplacer (bandeau, puis matchs, puis actualités…).
 * Chaque section occupe tout l'écran sous la barre de navigation et s'y colle ; plus haute que l'écran, elle défile
 * d'abord jusqu'en bas (son `top` collant est négatif). Recouverte, elle s'assombrit (variable --cover, globals.css).
 * Sans JavaScript, ou si l'appareil demande moins d'animations, la page défile normalement.
 */
export function SectionStack() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-stack]")];
    if (sections.length < 2) return;
    root.classList.add("stack-ready");

    // Hauteur de collage : juste sous l'en-tête fixe pour une section qui tient à l'écran (le bandeau, lui,
    // passe sous l'en-tête transparent), sinon décalée vers le haut pour en montrer le bas.
    const measure = () => {
      const vh = window.innerHeight;
      const header = document.querySelector("header")?.offsetHeight ?? 0;
      root.style.setProperty("--stack-header", `${header}px`);
      sections.forEach((s, i) => {
        s.style.setProperty("--stack-top", `${Math.min(i === 0 ? 0 : header, vh - s.offsetHeight)}px`);
        s.style.zIndex = String(i + 1);
      });
      update();
    };
    // Part recouverte par la section suivante (0 à 1).
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      sections.forEach((s, i) => {
        const next = sections[i + 1];
        const cover = next ? Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / vh)) : 0;
        s.style.setProperty("--cover", cover.toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const ro = new ResizeObserver(measure);
    sections.forEach((s) => ro.observe(s));
    // La barre de navigation s'affine une fois la page défilée : les sections restent collées contre elle.
    const nav = document.querySelector("header");
    if (nav) ro.observe(nav);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", schedule);
      root.classList.remove("stack-ready");
      root.style.removeProperty("--stack-header");
      for (const s of sections) {
        s.style.removeProperty("--stack-top");
        s.style.removeProperty("--cover");
        s.style.zIndex = "";
      }
    };
  }, []);
  return null;
}
