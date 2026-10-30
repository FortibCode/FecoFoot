/** Paramètres du portail : réseaux sociaux officiels et informations de la fédération (règles pures). */

export const SOCIAL_NETWORKS = ["facebook", "instagram", "x", "youtube"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = { facebook: "Facebook", instagram: "Instagram", x: "X (Twitter)", youtube: "YouTube" };

/** Domaines acceptés pour chaque réseau : un lien ne peut pas pointer ailleurs que vers le réseau annoncé. */
const SOCIAL_HOSTS: Record<SocialNetwork, string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
};

/** Lien d'un compte officiel : vide (aucun compte) ou adresse https du réseau. */
export function socialUrlError(network: SocialNetwork, raw: string): string | null {
  if (raw === "") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Adresse invalide.";
  }
  if (url.protocol !== "https:") return "L'adresse doit commencer par https://.";
  if (!SOCIAL_HOSTS[network].includes(url.hostname.toLowerCase())) return `Ce n'est pas une adresse ${SOCIAL_LABELS[network]}.`;
  if (url.pathname === "/" || url.pathname === "") return "Indiquez l'adresse du compte, pas celle du site.";
  return null;
}

/** Année de fondation : vide, ou une année passée plausible. */
export function foundedYearError(raw: string, currentYear: number): string | null {
  if (raw === "") return null;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1850 || year > currentYear) return `Année entre 1850 et ${currentYear}.`;
  return null;
}
