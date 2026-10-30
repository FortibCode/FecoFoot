import Link from "next/link";
import { NATIONAL_TEAM_SHORT, NATIONAL_TEAM_TAGLINES } from "@/lib/national-teams";

type Team = { slug: string; name: string };

/**
 * Carte d'une sélection : sa photo (photothèque) ou, à défaut, son repère en grand sur fond vert foncé ;
 * nom, description courte et « Découvrir la sélection ». Toute la carte est un lien.
 * `featured` : grande bannière (équipe A).
 */
export function TeamCard({ team, cover, featured = false }: { team: Team; cover?: string; featured?: boolean }) {
  const tagline = NATIONAL_TEAM_TAGLINES[team.slug];
  return (
    <Link
      href={`/equipes-nationales/${team.slug}`}
      className={`group relative isolate flex h-full flex-col justify-end overflow-hidden bg-brand-ink text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${featured ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[4/3]"}`}
    >
      {cover ? (
        <>
          {/* Photo d'illustration : le nom de la sélection, écrit sur la carte, donne le sens du lien. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
          <img src={cover} alt="" loading={featured ? "eager" : "lazy"} className="absolute inset-0 -z-10 size-full object-cover object-[50%_30%] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.85)_0%,rgb(0_0_0/0.35)_45%,transparent_75%)]" />
        </>
      ) : (
        // Sans photo : le repère de la sélection en très grand, discret, en haut de la carte.
        <span
          aria-hidden
          className={`absolute top-3 left-5 -z-10 font-display leading-none font-bold text-white/10 transition-colors duration-500 group-hover:text-[color-mix(in_srgb,var(--flag-yellow)_22%,transparent)] ${featured ? "text-[9rem] sm:text-[12rem]" : "text-[5.5rem] sm:text-[6.5rem]"}`}
        >
          {NATIONAL_TEAM_SHORT[team.slug] ?? team.name}
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
      <span className={`flex flex-col gap-1.5 ${featured ? "p-6 sm:p-10" : "p-5"}`}>
        {tagline && <span className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--flag-yellow)] uppercase">{tagline}</span>}
        <span className={`font-display leading-[1.05] font-bold uppercase ${featured ? "text-3xl sm:text-5xl" : "text-2xl"}`}>{team.name}</span>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white/85 group-hover:text-white">
          Découvrir la sélection
          <span aria-hidden className="transition-transform duration-300 motion-safe:group-hover:translate-x-1">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Sélections nationales : l'équipe A en grande bannière, puis les autres sélections en cartes de même format
 * (une colonne sur téléphone, deux sur tablette, trois sur ordinateur).
 */
export function NationalTeamCards({ teams, covers = {}, reveal = false }: { teams: readonly Team[]; covers?: Record<string, string>; reveal?: boolean }) {
  const [first, ...rest] = teams;
  const rv = (i: number) => (reveal ? { "data-reveal": "up", style: { ["--rd" as string]: `${i * 70}ms` } } : {});
  return (
    <div className="flex flex-col gap-4">
      {first && (
        <div {...rv(0)}>
          <TeamCard team={first} cover={covers[first.slug]} featured />
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((t, i) => (
          <li key={t.slug} {...rv(i + 1)}>
            <TeamCard team={t} cover={covers[t.slug]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
