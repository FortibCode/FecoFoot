import Link from "next/link";
import { ArrowCircle } from "@/components/public/ui";
import { NATIONAL_TEAM_TAGLINES } from "@/lib/national-teams";

/**
 * Cartes des sélections nationales (accueil, page « Équipes nationales ») : repère tricolore aux
 * couleurs du drapeau, nom de la sélection, accès à sa page. Toute la carte est un lien, d'un seul
 * nom accessible ; survol et focus clavier bien visibles, sans mouvement si l'appareil le demande.
 * Nombre impair de sélections : la première occupe deux colonnes, la grille reste pleine.
 */
export function NationalTeamCards({ teams, reveal = false }: { teams: readonly { slug: string; name: string }[]; reveal?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {teams.map((t, i) => (
        <li key={t.slug} className={teams.length % 2 === 1 && i === 0 ? "sm:col-span-2" : undefined} {...(reveal ? { "data-reveal": "up", style: { ["--rd" as string]: `${i * 70}ms` } } : {})}>
          <Link
            href={`/equipes-nationales/${t.slug}`}
            className="group flex h-full min-h-20 items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-flag-green/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span aria-hidden className="h-10 w-1.5 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-display text-xl leading-tight font-bold uppercase">{t.name}</span>
                {NATIONAL_TEAM_TAGLINES[t.slug] && <span className="text-xs font-medium text-muted-foreground">{NATIONAL_TEAM_TAGLINES[t.slug]}</span>}
              </span>
            </span>
            <ArrowCircle />
          </Link>
        </li>
      ))}
    </ul>
  );
}
