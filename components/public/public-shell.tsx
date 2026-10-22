import type { ReactNode } from "react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

/**
 * Mise en page des pages publiques du portail (M01).
 * `hero` remplace le bandeau de titre standard (page d'accueil).
 */
export function PublicShell({
  title,
  children,
  wide = false,
  hero,
  subtitle,
  bare = false,
  overlayHeader = false,
  logo,
}: {
  /** Rubrique de la page (n'est plus affichée au-dessus du titre). */
  eyebrow: string;
  title: string;
  children: ReactNode;
  wide?: boolean;
  hero?: ReactNode;
  /** Information utile sous le titre (date, saison, statut…), en texte simple. */
  subtitle?: string;
  /** Le contenu gère lui-même ses largeurs (sections pleine largeur de la page d'accueil). */
  bare?: boolean;
  /** L'en-tête se pose sur le bandeau `hero` (page d'accueil) : le bandeau doit lui réserver sa hauteur. */
  overlayHeader?: boolean;
  /** Logo officiel (championnat, ligue) affiché à côté du titre. */
  logo?: string | null;
}) {
  const width = wide ? "max-w-7xl lg:px-8" : "max-w-xl";
  return (
    <div className="relative flex flex-1 flex-col">
      <div aria-hidden className="crest-watermark" />
      <SiteHeader overlay={overlayHeader && Boolean(hero)} />
      <main className="flex flex-1 flex-col">
        {hero ?? (
          <div className="border-b bg-muted/60">
            <div
              className={`mx-auto flex w-full flex-col items-start gap-3 px-4 py-8 sm:px-6 sm:py-10 ${width}`}
            >
              <div className="flex items-center gap-4 sm:gap-6">
                {logo && (
                  // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
                  <img src={logo} alt="" className="size-20 shrink-0 rounded-xl border bg-white object-contain p-1.5 sm:size-24" />
                )}
                <div className="flex flex-col gap-3">
                  <h1 className="text-4xl leading-[1.02] font-bold uppercase sm:text-5xl">
                    {title}
                  </h1>
                  {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {bare ? (
          children
        ) : (
          <div
            className={`mx-auto w-full flex-1 px-4 pt-8 pb-12 sm:px-6 ${width}`}
          >
            {children}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
