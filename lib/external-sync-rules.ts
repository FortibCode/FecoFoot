/**
 * Synchronisation avec une source sportive externe — règles pures (testées unitairement).
 * Principe : la saisie officielle prime ; une donnée externe n'écrase jamais un résultat validé.
 */
import type { MatchStatus } from "@/lib/competitions";

export const EXTERNAL_PROVIDERS = ["API_FOOTBALL"] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];
export const EXTERNAL_PROVIDER_LABELS: Record<ExternalProvider, string> = { API_FOOTBALL: "API-Football (api-sports.io)" };

export const SCORE_SOURCES = ["OFFICIAL", "EXTERNAL"] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];

export const LINK_ENTITIES = ["competition", "club", "match"] as const;
export type LinkEntity = (typeof LINK_ENTITIES)[number];

/** Statut du fournisseur (codes courts API-Football) → statut de la plateforme ; null : inconnu, ignoré. */
export function mapExternalStatus(short: string): MatchStatus | null {
  const s = short.toUpperCase();
  if (["TBD", "NS"].includes(s)) return "SCHEDULED";
  if (["1H", "2H", "ET", "BT", "P", "LIVE"].includes(s)) return "LIVE";
  if (s === "HT") return "HALF_TIME";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(s)) return "FINISHED";
  if (s === "PST") return "POSTPONED";
  if (["SUSP", "INT"].includes(s)) return "SUSPENDED";
  if (["CANC", "ABD"].includes(s)) return "CANCELLED";
  return null;
}

/** Journée d'après l'intitulé du tour (« Regular Season - 7 » → 7) ; 1 à défaut. */
export function roundFromLabel(label: string | null | undefined): number {
  const m = label?.match(/(\d+)\s*$/);
  return m ? Math.max(1, Number(m[1])) : 1;
}

export type MatchState = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  validatedAt: Date | null;
  scoreSource: ScoreSource;
  /** Saisie officielle sur la feuille de match (statut ou buts) : elle prime sur la source externe. */
  officialEntry: boolean;
};

export type ExternalUpdate = { status: MatchStatus; homeScore: number | null; awayScore: number | null };

/**
 * Décision pour un match déjà lié : appliquer la donnée externe, l'ignorer, ou signaler un conflit.
 * - Résultat validé ou saisie officielle en cours : jamais modifié ; un écart devient un conflit à examiner.
 * - Sinon : le statut et le score externes sont appliqués (provenance « externe ») ; un match terminé
 *   reste « en attente de validation » par l'organisateur.
 */
export function decideExternalUpdate(current: MatchState, ext: ExternalUpdate): { action: "apply" | "skip" | "conflict"; reason?: string } {
  const differs = current.status !== ext.status || current.homeScore !== ext.homeScore || current.awayScore !== ext.awayScore;
  if (!differs) return { action: "skip" };
  if (current.validatedAt) return { action: "conflict", reason: "Résultat officiel validé : la source externe annonce une autre donnée." };
  if (current.officialEntry) return { action: "conflict", reason: "Feuille de match saisie officiellement : la source externe diffère." };
  return { action: "apply" };
}

/** Normalisation d'un nom de club pour proposer une correspondance (accents, casse, sigles usuels). */
export function normalizeClubName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(as|ac|fc|cs|csmd|club|sport(?:s|ive)?|de|du|la|le|d)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
