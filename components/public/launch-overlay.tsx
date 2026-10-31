"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LAUNCH_COOKIE } from "@/lib/launch";

/** Secours si la fin de l'animation n'est pas signalée (onglet en arrière-plan…). */
const FALLBACK = 4000;
/** Pas d'écran d'ouverture : espace fédéral, connexion, et ce qu'on présente au stade (billets, badges, vérifications). */
const SKIP = /^\/(admin|connexion|mot-de-passe-oublie|reinitialiser|accord|paiement|billet\/|accreditations\/(badge|suivi)|verifier\/)/;

/**
 * Animation d'ouverture : chevrons aux couleurs du drapeau, écusson qui apparaît, « FECOFOOT » lettre par lettre,
 * barre tricolore, puis l'écran s'efface vers le haut. N'intercepte aucun clic ; Échap le passe ; absent si
 * l'appareil demande moins d'animations (globals.css).
 */
export function LaunchOverlay() {
  const skipped = SKIP.test(usePathname());
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (skipped) return;
    // Vu pour toute la visite (cookie de session) : les pages suivantes ne le montrent plus.
    document.cookie = `${LAUNCH_COOKIE}=1; path=/; SameSite=Lax`;
    const end = setTimeout(() => setDone(true), FALLBACK);
    const skip = (e: KeyboardEvent) => e.key === "Escape" && setDone(true);
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(end);
      window.removeEventListener("keydown", skip);
    };
  }, [skipped]);
  if (done || skipped) return null;
  return (
    <div
      aria-hidden
      // Retiré dès la fin de l'effacement vers le haut.
      onAnimationEnd={(e) => e.animationName === "launch-out" && setDone(true)}
      className="launch-screen pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-brand-ink text-white">
      {/* Chevrons aux couleurs du drapeau qui traversent l'écran. */}
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="launch-chevrons absolute inset-y-0 -left-1/4 h-full w-[60%]">
        <polygon points="0,0 60,0 140,150 60,300 0,300 80,150" fill="var(--flag-green)" opacity="0.55" />
        <polygon points="70,0 110,0 190,150 110,300 70,300 150,150" fill="var(--flag-yellow)" opacity="0.35" />
      </svg>
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className="launch-chevrons-right absolute inset-y-0 -right-1/4 h-full w-[60%]">
        <polygon points="200,0 140,0 60,150 140,300 200,300 120,150" fill="var(--flag-red)" opacity="0.5" />
      </svg>

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <span className="launch-glow absolute top-6 size-56 rounded-full bg-[var(--flag-yellow)] blur-3xl sm:size-72" />
        {/* eslint-disable-next-line @next/next/no-img-element -- écusson officiel, fichier statique */}
        <img src="/logo-fecofoot.png" alt="" className="launch-crest relative h-36 w-auto drop-shadow-[0_18px_40px_rgb(0_0_0/0.5)] sm:h-48" />
        <p className="relative font-display text-5xl font-bold tracking-[0.12em] sm:text-7xl">
          {"FECOFOOT".split("").map((c, i) => (
            <span key={i} className="launch-letter inline-block" style={{ ["--i" as string]: i }}>
              {c}
            </span>
          ))}
        </p>
        <p className="launch-tagline relative font-display text-sm tracking-[0.3em] text-white/75 uppercase sm:text-base">Fédération Congolaise de Football</p>
        <span className="relative mt-2 h-1 w-48 overflow-hidden bg-white/15 sm:w-64">
          <span className="launch-bar absolute inset-0 origin-left bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
        </span>
      </div>
    </div>
  );
}
