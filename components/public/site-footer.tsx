import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { DivisionFooterLinks } from "@/components/public/divisions";
import { FooterSocials } from "@/components/public/site-settings";

const COLUMNS = [
  {
    title: "Compétitions",
    links: [
      ["/competitions", "Résultats et classements"],
      // Divisions nationales : noms lus en base (DivisionFooterLinks).
      ["divisions", ""],
      ["/ligues", "Ligues départementales"],
      ["/clubs", "Clubs affiliés"],
      ["/discipline", "Décisions disciplinaires"],
    ],
  },
  {
    title: "Équipes nationales",
    links: [
      ["/equipes-nationales", "Les Diables Rouges"],
      ["/actualites", "Actualités"],
      ["/accreditations", "Accréditations presse"],
    ],
  },
  {
    title: "Services",
    links: [
      ["/billetterie", "Billetterie"],
      ["/supporters", "Fan ID et supporters"],
      ["/verifier", "Vérifier une licence"],
      ["/connexion", "Espace fédéral"],
    ],
  },
] as const;

/** Pied de page du portail : écusson en filigrane, rubriques, réseaux sociaux officiels. */
export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-brand-ink text-sm text-white/70">
      <div className="flag-stripe h-1" />
      {/* Écusson en filigrane, blanc translucide, coupé par le bord droit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 -right-16 -z-10 aspect-[1741/1975] h-[135%] -translate-y-1/2 bg-white opacity-[0.05] [mask:url(/fecofoot-mark.svg)_center/contain_no-repeat] sm:-right-8"
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_2fr] lg:px-8 lg:py-16">
        <div data-reveal="up" className="flex flex-col gap-5">
          <Link href="/" className="flex items-center gap-4">
            <BrandLogo size={64} decorative />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-2xl font-bold tracking-wide text-white">FECOFOOT</span>
              <span className="text-xs uppercase tracking-[0.16em] text-white/55">Fédération Congolaise de Football</span>
            </span>
          </Link>
          <p className="max-w-sm">
            Licences, compétitions, équipes nationales, billetterie et supporters : la plateforme officielle du football congolais.
          </p>
          {/* Comptes officiels : paramètres du portail (administration). */}
          <FooterSocials />
        </div>
        <nav aria-label="Liens utiles" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((c, i) => (
            <div key={c.title} data-reveal="up" style={{ ["--rd" as string]: `${120 + i * 100}ms` }} className="flex flex-col gap-3">
              <p className="font-heading text-base font-semibold uppercase tracking-wide text-white">{c.title}</p>
              <ul className="flex flex-col gap-2">
                {c.links.map(([href, label]) =>
                  href === "divisions" ? (
                    <DivisionFooterLinks key={href} />
                  ) : (
                    <li key={href}>
                      <Link href={href} className="transition-colors hover:text-[var(--flag-yellow)]">
                        {label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Fédération Congolaise de Football · Brazzaville, République du Congo</p>
          <p>Site officiel de la FECOFOOT</p>
        </div>
      </div>
    </footer>
  );
}
