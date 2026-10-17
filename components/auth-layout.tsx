import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

/** Pages d'accès à l'espace fédéral : panneau de marque à gauche (grand écran), formulaire à droite. */
export function AuthLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="brand-band relative flex flex-col justify-between gap-6 overflow-hidden px-6 py-6 lg:w-[44%] lg:px-12 lg:py-12">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo size={44} decorative />
          <span className="font-heading text-xl font-bold tracking-wide">FECOFOOT</span>
        </Link>
        <div className="hidden lg:block">
          <BrandLogo size={220} decorative className="mb-8 drop-shadow-2xl" />
          <p className="font-heading text-4xl leading-tight font-bold uppercase">Le football congolais,<br />géré en un seul endroit.</p>
          <p className="mt-4 max-w-sm text-white/70">Licences, transferts, compétitions, sélections, billetterie : l&apos;espace de travail de la fédération, des ligues et des clubs.</p>
        </div>
        <p className="hidden text-xs text-white/50 lg:block">© Fédération Congolaise de Football</p>
        <div className="flag-stripe absolute inset-x-0 bottom-0 h-1 lg:hidden" />
        <div className="absolute inset-y-0 right-0 hidden w-1.5 bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)] lg:block" />
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-10 lg:items-center lg:py-12">
        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--flag-green)]">Espace fédéral</p>
          <h1 className="mt-1 mb-2 text-3xl font-bold">{title}</h1>
          {intro && <p className="mb-6 text-sm text-muted-foreground">{intro}</p>}
          {!intro && <div className="mb-6" />}
          {children}
        </div>
      </main>
    </div>
  );
}
