import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { DivisionFooterLinks } from "@/components/public/divisions";

/** Comptes officiels de la FECOFOOT (repris du site fecofoot.cg). */
const SOCIALS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/fecofootcg",
    path: "M13.5 21v-7.5h2.5l.4-3H13.5V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.8v2.4H8v3h2.5V21h3z",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/fecofoot_rc",
    path: "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.8-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM20.9 8c-.1-1.4-.4-2.7-1.4-3.6-1-1-2.2-1.3-3.6-1.4H8.1c-1.4.1-2.7.4-3.6 1.4-1 1-1.3 2.2-1.4 3.6v7.9c.1 1.4.4 2.7 1.4 3.6 1 1 2.2 1.3 3.6 1.4h7.8c1.4-.1 2.7-.4 3.6-1.4 1-1 1.3-2.2 1.4-3.6V8zm-1.6 8.5c-.2.5-.6 1-1.1 1.2-.8.3-2.6.2-3.4.2h-5.6c-.8 0-2.7.1-3.4-.2-.5-.2-.9-.6-1.1-1.2-.3-.8-.2-2.6-.2-3.4v-2.3c0-.8-.1-2.7.2-3.4.2-.5.6-1 1.1-1.2.8-.3 2.6-.2 3.4-.2h5.6c.8 0 2.7-.1 3.4.2.5.2.9.6 1.1 1.2.3.8.2 2.6.2 3.4v2.3c0 .8.1 2.7-.2 3.4z",
  },
  {
    name: "X",
    href: "https://x.com/fecofoot_cg",
    path: "M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.3 4.7H5.4l11.3 14.5z",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/channel/UCmOWGzjrFxOh36xvlYGmWIg",
    path: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z",
  },
] as const;

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
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Suivez-nous</p>
            <ul className="flex gap-2.5">
              {SOCIALS.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`FECOFOOT sur ${s.name}`}
                    className="flex size-10 items-center justify-center rounded-md border border-white/20 text-white transition motion-safe:hover:-translate-y-0.5 hover:border-[var(--flag-yellow)] hover:bg-[var(--flag-yellow)] hover:text-brand-ink focus-visible:outline-white"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden className="size-[1.15rem]" fill="currentColor">
                      <path d={s.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
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
