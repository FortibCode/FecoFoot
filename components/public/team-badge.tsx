import { ClubLogo } from "@/components/public/club-logo";

const SIZES = {
  xs: "size-6",
  sm: "size-8",
  md: "size-11",
  lg: "size-16 sm:size-20",
  xl: "size-24 sm:size-32",
} as const;

/**
 * Équipe dans un rond blanc à fin contour (affichage des matchs) : logo du club, écusson de la fédération
 * pour le Congo, drapeau pour les autres sélections, initiales à défaut. Décoratif : le nom est écrit à côté.
 */
export function TeamBadge({ name, logo, flag, size = "sm", className = "" }: { name: string; logo?: string | null; flag?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const congo = Boolean(flag) && name === "Congo";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/10 ${SIZES[size]} ${className}`}>
      {congo ? (
        // eslint-disable-next-line @next/next/no-img-element -- écusson de la fédération (fichier statique)
        <img src="/logo-fecofoot.png" alt="" className="size-[78%] object-contain" />
      ) : flag ? (
        // eslint-disable-next-line @next/next/no-img-element -- drapeau SVG statique
        <img src={flag} alt="" className="size-[72%] rounded-full object-cover ring-1 ring-black/5" />
      ) : logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
        <img src={logo} alt="" loading="lazy" className="size-[76%] object-contain" />
      ) : (
        <ClubLogo name={name} className="size-full text-[0.55rem]" />
      )}
    </span>
  );
}
