import Link from "next/link";
import type { ReactNode } from "react";

/** Flèche dans un rond (↗), décorative. */
export function ArrowCircle({ tone = "light", className = "" }: { tone?: "light" | "dark" | "solid"; className?: string }) {
  const colors = {
    light: "bg-background text-foreground group-hover:bg-[var(--flag-green)] group-hover:text-white",
    dark: "border border-white/25 text-white group-hover:bg-white group-hover:text-brand-ink",
    solid: "bg-white text-brand-ink",
  }[tone];
  return (
    <span aria-hidden className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors ${colors} ${className}`}>
      <svg viewBox="0 0 16 16" className="size-3.5 transition-transform motion-safe:group-hover:rotate-45" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12 12 4M5.5 4H12v6.5" />
      </svg>
    </span>
  );
}

/** Bouton-lien rectangulaire : libellé puis flèche qui avance au survol. */
export function PillLink({ href, children, variant = "yellow" }: { href: string; children: ReactNode; variant?: "yellow" | "green" | "ghost" }) {
  const styles = {
    yellow: "bg-[var(--flag-yellow)] text-brand-ink hover:brightness-95",
    green: "bg-primary text-primary-foreground hover:brightness-110",
    ghost: "border border-white/70 text-white hover:bg-white hover:text-brand-ink",
  }[variant];
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${styles}`}>
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}

/** En-tête de section : étiquette, titre bicolore à gauche ; texte et action à droite. */
export function SectionHead({
  id,
  title,
  highlight,
  aside,
  action,
  tone = "light",
}: {
  /** Identifiant du titre (aria-labelledby de la section). */
  id?: string;
  title: string;
  highlight?: string;
  aside?: string;
  action?: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2 md:items-end">
      <div data-reveal="left" className="flex flex-col gap-3">
        <h2 id={id} className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
          {title}
          {highlight && (
            <>
              {" "}
              <span className={tone === "dark" ? "text-[var(--flag-yellow)]" : "text-[var(--flag-green)]"}>{highlight}</span>
            </>
          )}
        </h2>
      </div>
      {(aside || action) && (
        <div data-reveal="right" className="flex flex-col items-start gap-4 md:max-w-sm md:justify-self-end">
          {aside && <p className={`text-sm ${tone === "dark" ? "text-white/70" : "text-muted-foreground"}`}>{aside}</p>}
          {action}
        </div>
      )}
    </div>
  );
}
