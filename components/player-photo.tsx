/** Photo d'identité d'un joueur, ou ses initiales quand aucune photo n'est publiée. */
export function PlayerPhoto({ src, firstName, lastName, className = "size-16" }: { src?: string | null; firstName: string; lastName: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par la route des licences (contrôle d'accès)
    return <img src={src} alt={`${firstName} ${lastName}`} loading="lazy" className={`shrink-0 rounded-xl border bg-muted object-cover ${className}`} />;
  }
  return (
    <span aria-hidden className={`brand-band flex shrink-0 items-center justify-center rounded-xl font-heading font-bold ${className.includes("text-") ? "" : "text-xl"} ${className}`}>
      {`${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()}
    </span>
  );
}
