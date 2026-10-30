"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Photo qui se retourne au toucher (ou au clic, ou au clavier) : au recto l'image, au verso sa légende,
 * la sélection, le crédit et l'accès à la galerie. Rotation 3D, instantanée si l'appareil demande moins
 * d'animations.
 */
export function FlipPhoto({ src, caption, team, credit, href }: { src: string; caption: string; team: string | null; credit: string | null; href: string }) {
  const [flipped, setFlipped] = useState(false);
  const face = "absolute inset-0 overflow-hidden [backface-visibility:hidden]";
  return (
    <div className="relative aspect-[3/4] [perspective:1400px]">
      <div
        className="relative size-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Recto : la photo */}
        <button
          type="button"
          onClick={() => setFlipped(true)}
          aria-label={`Afficher la légende : ${caption}`}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          className={`group ${face} block cursor-pointer bg-muted text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
          <img src={src} alt="" loading="lazy" className="size-full object-cover object-top text-transparent transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" />
        </button>

        {/* Verso : le texte de la photo, sur fond jaune ; un clic n'importe où (hors lien) ramène la photo. */}
        <div
          role="button"
          tabIndex={flipped ? 0 : -1}
          aria-hidden={!flipped}
          aria-label="Revenir à la photo"
          onClick={() => setFlipped(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped(false);
            }
          }}
          className={`${face} flex cursor-pointer flex-col justify-between gap-2 bg-[var(--flag-yellow)] p-3 text-brand-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand-ink sm:gap-4 sm:p-5 [transform:rotateY(180deg)] ${flipped ? "" : "pointer-events-none"}`}
        >
          <div className="flex min-h-0 flex-col gap-2 sm:gap-3">
            <span aria-hidden className="h-1 w-12 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--brand-ink)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
            {team && <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--flag-green)] uppercase">{team}</span>}
            <p className="line-clamp-4 font-display text-base leading-tight font-semibold uppercase sm:text-2xl">{caption}</p>
            {credit && <p className="line-clamp-2 text-[0.7rem] text-brand-ink/70 sm:text-xs">© {credit}</p>}
          </div>
          <Link
            href={href}
            tabIndex={flipped ? 0 : -1}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand-ink underline underline-offset-4 hover:text-[var(--flag-green)] sm:text-sm"
          >
            Toutes les photos <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
