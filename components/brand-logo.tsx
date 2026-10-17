import Image from "next/image";

/** Écusson officiel de la FECOFOOT (fichier public/logo-fecofoot.png, 256 × 256, version HD 512 px dans app/icon.png). */
export function BrandLogo({ size = 36, className, decorative = false }: { size?: number; className?: string; decorative?: boolean }) {
  // Décoratif quand le nom « FECOFOOT » est écrit à côté : pas de doublon pour les lecteurs d'écran.
  return <Image src="/logo-fecofoot.png" alt={decorative ? "" : "FECOFOOT"} width={size} height={size} unoptimized priority className={className} />;
}
