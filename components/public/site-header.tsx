"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PublicNav } from "@/components/public/public-nav";

/**
 * En-tête de marque, toujours visible en haut de l'écran : écusson, nom de la fédération et menu.
 * `overlay` (page d'accueil) : transparent sur le bandeau photo, puis fond sombre dès qu'on fait défiler.
 */
export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [overlay]);

  const solid = !overlay || scrolled;
  return (
    <header
      className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-40 text-white transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        solid ? "bg-brand-ink/95 shadow-lg backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav
        aria-label="Portail"
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-[padding] duration-300 sm:px-6 lg:px-8 ${overlay && !scrolled ? "py-3 sm:py-4" : "py-2.5"}`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <BrandLogo size={48} decorative className={`transition-[width,height] duration-300 ${solid ? "size-10" : "size-12"}`} />
          <span className="flex flex-col leading-none">
            <span className="font-heading text-xl font-bold tracking-wide">FECOFOOT</span>
            <span className="mt-1 hidden text-[0.65rem] uppercase tracking-[0.18em] text-white/60 sm:block">Fédération Congolaise de Football</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Accès direct aux billets achetés (connexion demandée si besoin, puis retour à l'espace). */}
          <Link
            href="/supporters/espace#billets"
            className="flex items-center gap-2 rounded-md border border-white/25 px-3 py-2 text-sm font-semibold transition-colors hover:border-[var(--flag-yellow)] hover:text-[var(--flag-yellow)]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
              <path d="M14 6v12" strokeDasharray="2 2" />
            </svg>
            <span>Mes billets</span>
          </Link>
          <PublicNav />
        </div>
      </nav>
      <div className={`flag-stripe h-1 transition-opacity duration-300 ${solid ? "opacity-100" : "opacity-0"}`} />
    </header>
  );
}
