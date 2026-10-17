"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const LINKS = [
  ["/actualites", "Actualités"],
  ["/competitions", "Compétitions"],
  ["/clubs", "Clubs"],
  ["/equipes-nationales", "Équipes nationales"],
  ["/verifier", "Vérifier une licence"],
  ["/billetterie", "Billetterie"],
  ["/supporters", "Supporters"],
  ["/accreditations", "Presse"],
] as const;

/**
 * Menu du portail derrière un bouton « Menu » : panneau déroulé sous l'en-tête, rubrique en cours
 * mise en évidence. Se ferme avec Échap, par un clic à l'extérieur ou en changeant de page.
 */
export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fermé à chaque changement de page (ajustement au rendu, sans effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 flex size-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
      >
        <span aria-hidden className="relative block h-3 w-4 scale-125">
          <span
            className={`absolute left-0 h-0.5 w-4 bg-current transition-all ${open ? "top-[5px] rotate-45" : "top-0"}`}
          />
          <span
            className={`absolute top-[5px] left-0 h-0.5 w-4 bg-current transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`absolute left-0 h-0.5 w-4 bg-current transition-all ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`}
          />
        </span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="brand-band absolute inset-x-0 top-full z-40 border-t border-white/10 shadow-2xl"
      >
        <ul className="mx-auto grid max-w-7xl px-4 sm:px-6 lg:px-8 gap-1 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-md px-3 py-3 font-heading text-lg font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? "bg-white/10 text-[var(--flag-yellow)]"
                      : "text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                  <span aria-hidden className="text-sm text-white/40">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flag-stripe h-1" />
      </div>
    </div>
  );
}
