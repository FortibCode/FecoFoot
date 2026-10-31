import type { ReactNode } from "react";

/**
 * Titre de rubrique du portail : pictogramme dans une pastille verte, titre, phrase d'explication facultative,
 * et un élément à droite (recherche, lien). Remplace les titres soulignés d'un trait noir.
 * `reveal={false}` : sans animation d'apparition (contenu envoyé en flux dans un Suspense, que l'animation
 * modifierait avant son hydratation).
 */
export function SectionTitle({ id, icon, title, text, aside, level = 2, reveal = true }: { id?: string; icon: ReactNode; title: ReactNode; text?: ReactNode; aside?: ReactNode; level?: 2 | 3; reveal?: boolean }) {
  const Heading = level === 2 ? "h2" : "h3";
  const rv = (kind: string, delay = 0) => (reveal ? { "data-reveal": kind, style: { ["--rd" as string]: `${delay}ms` } } : {});
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-4">
        <span {...rv("zoom")} aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]">
          {icon}
        </span>
        <div {...rv("left", 100)} className="flex flex-col gap-1">
          <Heading id={id} className={`leading-tight font-bold uppercase ${level === 2 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>
            {title}
          </Heading>
          {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}
