import "server-only";
import { hasScore, liveMinute, type MatchPeriod } from "@/lib/competitions";
import type { MatchRow } from "@/lib/queries/competitions";

/** En-têtes des réponses de l'API publique (lecture seule, mise en cache courte). */
export const API_HEADERS = { "Cache-Control": "public, max-age=30", "Access-Control-Allow-Origin": "*" } as const;

export const notFound = () => Response.json({ error: "Introuvable." }, { status: 404, headers: API_HEADERS });

/**
 * Match publié : le score n'est donné que s'il est officiel (terminé et validé) ou en cours
 * sur saisie officielle ; un résultat en attente de validation est signalé, sans score.
 */
export function publicMatch(r: MatchRow) {
  const m = r.match;
  const awaiting = m.status === "FINISHED" && !m.validatedAt;
  const scored = hasScore(m.status) && !awaiting;
  return {
    id: m.id,
    round: m.round,
    zone: m.pool,
    kickoffAt: m.kickoffAt,
    venue: m.venue,
    status: m.status,
    // Minute de jeu d'un match en cours (« 63' », « 45+2' ») ; null hors du jeu ou chronomètre inconnu.
    minute: m.status === "LIVE" ? liveMinute(m.period as MatchPeriod | null, m.periodStartedAt) : null,
    official: m.status === "FINISHED" && Boolean(m.validatedAt),
    // Provenance : saisie officielle de la fédération, ou source sportive externe (non officielle avant validation).
    source: m.scoreSource,
    awaitingValidation: awaiting,
    home: r.home ? { id: r.home.id, name: r.home.name, logo: r.home.logo } : null,
    away: r.away ? { id: r.away.id, name: r.away.name, logo: r.away.logo } : null,
    score: scored ? { home: m.homeScore ?? 0, away: m.awayScore ?? 0 } : null,
    penalties: scored && m.homePenalties !== null && m.awayPenalties !== null ? { home: m.homePenalties, away: m.awayPenalties } : null,
    competition: { id: r.competition.id, name: r.competition.name, slug: r.competition.slug, season: r.competition.season },
  };
}
