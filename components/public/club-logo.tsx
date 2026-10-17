/** Logo d'un club, ou ses initiales sur une pastille quand le club n'a pas encore de logo. */
export function ClubLogo({ src, name, className = "size-12" }: { src?: string | null; name: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
    return <img src={src} alt="" loading="lazy" className={`shrink-0 object-contain ${className}`} />;
  }
  const initials = name
    .replace(/^(AS|AC|FC|CS|CSMD|JS)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className={`brand-band flex shrink-0 items-center justify-center rounded-full font-heading font-bold ${className}`}>
      {initials}
    </span>
  );
}
