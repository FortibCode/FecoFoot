/** Formats d'affichage : français, fuseau de Brazzaville, montants en FCFA (§7.4, RG-17). */

const TZ = "Africa/Brazzaville";

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export const formatDateTime = (d: Date | null | undefined) => (d ? dateTimeFmt.format(d) : "—");
export const formatDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");

const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayMonthFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "long" });
const longDateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });

/** Heure à Brazzaville (« 20:00 »), ou null si l'heure n'est pas connue (saisie à minuit). */
export function kickoffTime(d: Date): string | null {
  const t = timeFmt.format(d);
  return t === "00:00" ? null : t.replace(":", "h");
}
/** « 13 novembre ». */
export const formatDayMonth = (d: Date) => dayMonthFmt.format(d);
/** « 29 septembre 2026 », suivi de l'heure si elle est connue. */
export function formatMatchDate(d: Date): string {
  const t = kickoffTime(d);
  return t ? `${longDateFmt.format(d)} · ${t}` : longDateFmt.format(d);
}

/** Montant entier en francs CFA, sans décimale : 25 000 FCFA. */
export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(amount))} FCFA`;
}

/** Identifiant d'URL : minuscules, sans accents, mots séparés par des tirets. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Il y a `n` jours (bornes des listes « récentes »). */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Date passée (ex. coup d'envoi donné). */
export const isPast = (d: Date | null) => d !== null && d.getTime() <= Date.now();
