import Link from "next/link";
import type { ReactNode } from "react";
import { GroupIcon, TrophyIcon, WomanIcon } from "@/components/public/icons";

/** Sélection telle qu'enregistrée en base : sous-titre et repère court modifiables dans l'administration. */
type Team = { slug: string; code: string; name: string; tagline: string | null; shortLabel: string | null };

/**
 * Couleurs de chaque sélection : fond uni et forme d'accent, toujours aux couleurs du drapeau
 * (texte blanc lisible sur chacun des fonds).
 */
const THEMES: Record<string, { bg: string; accent: string }> = {
  A: { bg: "var(--flag-green)", accent: "var(--flag-yellow)" },
  A_LOCAL: { bg: "var(--brand-ink)", accent: "var(--flag-green)" },
  U23: { bg: "var(--flag-red)", accent: "var(--flag-yellow)" },
  U20: { bg: "var(--flag-green)", accent: "var(--flag-yellow)" },
  U17: { bg: "var(--brand-ink)", accent: "var(--flag-yellow)" },
  U15: { bg: "var(--flag-red)", accent: "var(--brand-ink)" },
  WOMEN: { bg: "var(--flag-green)", accent: "var(--flag-red)" },
};
const theme = (code: string) => THEMES[code] ?? THEMES.A;

const icon = (code: string, className: string): ReactNode =>
  code === "WOMEN" ? <WomanIcon className={className} /> : code === "A" ? <TrophyIcon className={className} /> : <GroupIcon className={className} />;

/** Grand chevron qui déborde du bord droit : la forme d'accent de la carte (s'avance au survol). */
function Chevron({ color, small = false }: { color: string; small?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 300"
      preserveAspectRatio="xMaxYMid slice"
      className={`absolute right-0 -z-10 transition-transform duration-500 ease-out motion-safe:group-hover:translate-x-2 ${small ? "bottom-0 h-[42%] w-[30%]" : "inset-y-0 h-full w-[30%] sm:w-[46%]"}`}
    >
      <polygon points="70,0 200,0 200,300 70,300 150,150" fill={color} />
      <polygon points="-30,0 22,0 102,150 22,300 -30,300 50,150" fill={color} opacity="0.35" />
    </svg>
  );
}

/** Badge encadré : pictogramme, séparateur, libellé. */
function Badge({ code, children }: { code: string; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 border-2 border-white/85 px-2 py-1.5 transition-colors group-hover:bg-white/10 sm:gap-3 sm:px-3 sm:py-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-white/85 sm:size-8">{icon(code, "size-3 sm:size-4")}</span>
      <span aria-hidden className="h-5 w-px shrink-0 bg-white/70 sm:h-7" />
      <span className="line-clamp-2 font-display text-[0.65rem] leading-tight font-bold tracking-wide uppercase sm:text-sm">{children}</span>
    </span>
  );
}

/** Photo de la sélection (photothèque) sous un voile à ses couleurs : le texte reste lisible. */
function Photo({ src, color, tall }: { src: string; color: string; tall: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
      <img src={src} alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover object-[50%_25%] transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]" />
      <span
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: tall
            ? `linear-gradient(to top, color-mix(in srgb, ${color} 94%, transparent) 0%, color-mix(in srgb, ${color} 55%, transparent) 42%, color-mix(in srgb, ${color} 10%, transparent) 70%), linear-gradient(to bottom, rgb(0 0 0 / 0.45), transparent 30%)`
            : `linear-gradient(90deg, color-mix(in srgb, ${color} 92%, transparent) 0%, color-mix(in srgb, ${color} 65%, transparent) 45%, color-mix(in srgb, ${color} 15%, transparent) 80%)`,
        }}
      />
    </>
  );
}

/** Écusson de la fédération et nom de la sélection empilés : « FECOFOOT / DIABLES ROUGES / U-17 ». */
function Lockup({ team, large = false }: { team: Team; large?: boolean }) {
  return (
    <span className={`flex gap-3 sm:flex-row sm:items-center sm:gap-4 ${large ? "flex-row items-center" : "flex-col items-start"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- écusson officiel, fichier statique */}
      <img src="/logo-fecofoot.png" alt="" className={`w-auto shrink-0 drop-shadow-[0_4px_10px_rgb(0_0_0/0.25)] ${large ? "h-20 sm:h-28" : "h-12 sm:h-16"}`} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-display text-[0.6rem] font-bold tracking-[0.2em] text-white/80 uppercase sm:text-xs">FECOFOOT</span>
        <span className={`mt-1 font-display font-bold uppercase ${large ? "text-xl sm:text-3xl" : "text-sm sm:text-lg"}`}>Diables Rouges</span>
        <span className={`font-display leading-[0.95] font-bold uppercase ${large ? "text-6xl sm:text-8xl" : "text-4xl sm:text-5xl"}`}>{team.shortLabel ?? team.name}</span>
      </span>
    </span>
  );
}

/**
 * Carte d'une sélection : sa photo (photothèque) sous un voile à ses couleurs, ou à défaut un fond uni ;
 * chevron d'accent, écusson et nom empilés, badge encadré (sous-titre). `tall` : format vertical
 * (accueil, trois colonnes). Toute la carte est un lien vers la sélection.
 */
export function TeamCard({ team, cover, tall = false }: { team: Team; cover?: string; tall?: boolean }) {
  const t = theme(team.code);
  return (
    <Link
      href={`/equipes-nationales/${team.slug}`}
      aria-label={team.name}
      style={{ backgroundColor: t.bg }}
      className={`group relative isolate flex h-full flex-col justify-between overflow-hidden p-3.5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green sm:p-6 ${tall ? "aspect-[4/5]" : "aspect-[3/4] sm:aspect-[16/10]"}`}
    >
      {cover && <Photo src={cover} color={t.bg} tall={tall} />}
      <Chevron color={t.accent} small={Boolean(cover)} />
      <Lockup team={team} />
      {/* Téléphone : sous-titre en texte simple (la carte est étroite) ; plus large : badge encadré. */}
      {team.tagline && <span className={`max-w-[68%] font-display text-[0.7rem] leading-tight font-bold tracking-wide text-white/85 uppercase ${tall ? "hidden" : "sm:hidden"}`}>{team.tagline}</span>}
      <span className={`max-w-[62%] ${tall ? "flex max-w-[70%]" : "hidden sm:flex"}`}>
        <Badge code={team.code}>{team.tagline ?? team.name}</Badge>
      </span>
    </Link>
  );
}

/** Frise de chevrons (haut ou bas de la grande carte), dans la couleur d'accent. */
function Frieze({ color, id, bottom = false }: { color: string; id: string; bottom?: boolean }) {
  return (
    <svg aria-hidden className={`absolute inset-x-0 -z-10 h-9 w-full sm:h-14 ${bottom ? "bottom-0 rotate-180" : "top-0"}`}>
      <defs>
        <pattern id={id} width="150" height="56" patternUnits="userSpaceOnUse">
          <polygon points="10,0 58,0 75,26 92,0 140,0 98,56 52,56" fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Grande carte de l'équipe A : frises de chevrons en haut et en bas, au centre l'écusson et le nom,
 * un trait vertical, puis le badge « Découvrir la sélection ».
 */
export function FeaturedTeamCard({ team, cover }: { team: Team; cover?: string }) {
  const t = theme(team.code);
  return (
    <Link
      href={`/equipes-nationales/${team.slug}`}
      aria-label={team.name}
      style={{ backgroundColor: t.bg }}
      className="group relative isolate flex min-h-80 items-center justify-center overflow-hidden px-5 py-14 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green sm:aspect-[21/8] sm:min-h-0 sm:px-10"
    >
      {cover && <Photo src={cover} color={t.bg} tall={false} />}
      <Frieze color={t.accent} id={`frise-haut-${team.slug}`} />
      <Frieze color={t.accent} id={`frise-bas-${team.slug}`} bottom />
      <span className="flex flex-col items-center gap-5 transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.02] sm:flex-row sm:gap-10">
        <span className="flex flex-col items-center gap-3 sm:items-start">
          <Lockup team={team} large />
          {team.tagline && <span className="bg-brand-ink px-3 py-1 font-display text-xs font-bold tracking-[0.18em] uppercase sm:text-sm">{team.tagline}</span>}
        </span>
        <span aria-hidden className="hidden h-28 w-px bg-white/70 sm:block" />
        <Badge code={team.code}>Découvrir la sélection</Badge>
      </span>
    </Link>
  );
}

/**
 * Sélections nationales de l'accueil : trois cartes verticales côte à côte, avec leurs photos (les sélections
 * illustrées d'abord, dans l'ordre officiel), puis « Voir plus » vers la page de toutes les sélections.
 */
export function NationalTeamCards({ teams, covers = {}, count = 3, reveal = false }: { teams: readonly Team[]; covers?: Record<string, string>; count?: number; reveal?: boolean }) {
  const rv = (i: number) => (reveal ? { "data-reveal": "left", style: { ["--rd" as string]: `${i * 150}ms` } } : {});
  // Les sélections qui ont une photo d'abord (ordre officiel conservé) ; les autres sont sur la page complète.
  const shown = [...teams.filter((t) => covers[t.slug]), ...teams.filter((t) => !covers[t.slug])].slice(0, count);
  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-3">
        {shown.map((t, i) => (
          <li key={t.slug} {...rv(i)}>
            <TeamCard team={t} cover={covers[t.slug]} tall />
          </li>
        ))}
      </ul>
      {teams.length > count && (
        <Link
          href="/equipes-nationales"
          className="group inline-flex items-center gap-2 self-center bg-[var(--flag-green)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green"
        >
          Voir plus
          <span className="font-normal text-white/80">· toutes les sélections ({teams.length})</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
