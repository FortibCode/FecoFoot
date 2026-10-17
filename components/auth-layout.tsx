import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Pages d'accès à l'espace fédéral : carte centrée sur fond vert, panneau de marque à gauche
 * (écusson, cercles aux couleurs du drapeau), formulaire épuré à droite.
 */
export function AuthLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(120%_120%_at_0%_0%,#0f5a32_0%,var(--brand-ink)_55%,#06130d_100%)] px-4 py-10">
      {/* Écusson en filigrane sur le fond. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 -z-10 aspect-[1741/1975] h-[80vh] bg-white opacity-[0.04] [mask:url(/fecofoot-mark.svg)_center/contain_no-repeat]"
      />
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-[0_30px_80px_rgb(0_0_0/0.45)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 md:grid-cols-[1fr_1.05fr]">
        {/* Panneau de marque */}
        <aside className="relative isolate flex flex-col items-center justify-center gap-4 overflow-hidden bg-[linear-gradient(150deg,#0b7a3d_0%,#006b35_45%,#044423_100%)] px-8 py-10 text-center text-white md:py-16">
          {/* Cercles aux couleurs du drapeau. */}
          <span aria-hidden className="absolute -top-16 -left-16 -z-10 size-56 rounded-full bg-[var(--flag-green)] opacity-60 blur-[1px]" />
          <span aria-hidden className="absolute -right-20 -bottom-28 -z-10 size-60 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffe873,var(--flag-yellow)_55%,#d9b51a)] shadow-2xl" />
          <span aria-hidden className="absolute bottom-10 -left-12 -z-10 size-32 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff5a4f,var(--flag-red)_60%,#a8130f)] shadow-xl" />
          <Link href="/" aria-label="Retour au portail FECOFOOT" className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <BrandLogo size={150} decorative className="w-28 drop-shadow-[0_12px_24px_rgb(0_0_0/0.35)] md:w-36" />
          </Link>
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both">
            <p className="font-heading text-3xl font-bold tracking-wide uppercase md:text-4xl">Bienvenue</p>
            <p className="mt-1 text-xs font-semibold tracking-[0.25em] text-white uppercase [text-shadow:0_1px_6px_rgb(0_0_0/0.45)]">Espace fédéral</p>
          </div>
        </aside>

        {/* Formulaire */}
        <main className="relative isolate flex flex-col justify-center overflow-hidden px-6 pt-10 pb-14 sm:px-10 md:py-16">
          <span aria-hidden className="absolute -right-12 -bottom-12 -z-10 size-24 rounded-full bg-[var(--flag-red)] opacity-90" />
          <span aria-hidden className="absolute -right-16 bottom-2 -z-20 size-20 rounded-full bg-[var(--flag-yellow)]" />
          <h1 className="text-3xl font-bold uppercase sm:text-4xl">{title}</h1>
          <div aria-hidden className="mt-2 mb-6 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--flag-green)_0_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
          {intro && <p className="mb-5 text-sm text-muted-foreground">{intro}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
