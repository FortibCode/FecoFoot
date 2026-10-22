import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { competitions, competitionTeams, externalConflicts, externalLinks, externalSyncRuns, matchEvents, matches } from "@/lib/db/schema";
import { decideExternalUpdate, mapExternalStatus, roundFromLabel } from "@/lib/external-sync-rules";
import { ExternalApiError, fixturesOf } from "@/lib/integrations/api-football";
import { recomputeMatch } from "@/lib/queries/competitions";

const PROVIDER = "API_FOOTBALL" as const;

export type SyncResult = { runId: number; created: number; updated: number; conflicts: number; skipped: number; error: string | null; notes: string[] };

/**
 * Synchronise une compétition liée à une ligue du fournisseur : calendrier (nouveaux matchs, dates, stades)
 * et scores (en direct, terminés). Règles (lib/external-sync-rules.ts) :
 *  - une équipe non associée à un club est ignorée (signalée) : aucun club n'est créé automatiquement ;
 *  - date et stade ne sont mis à jour que si le match n'a jamais été programmé officiellement ;
 *  - score et statut : appliqués avec la provenance « externe », sauf résultat validé ou feuille de match
 *    officielle → conflit enregistré, examiné par un responsable. Un match terminé reste à valider.
 */
export async function syncCompetition(competitionId: number, trigger: "manual" | "cron"): Promise<SyncResult> {
  const [run] = await db.insert(externalSyncRuns).values({ provider: PROVIDER, competitionId, trigger }).returning({ id: externalSyncRuns.id });
  const result: SyncResult = { runId: run.id, created: 0, updated: 0, conflicts: 0, skipped: 0, error: null, notes: [] };
  try {
    const [link] = await db
      .select()
      .from(externalLinks)
      .where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "competition"), eq(externalLinks.entityId, competitionId)))
      .limit(1);
    if (!link) throw new ExternalApiError("Compétition non liée à une ligue du fournisseur.");
    const { data, remaining } = await fixturesOf(Number(link.externalId), link.externalSeason);
    if (remaining !== null) result.notes.push(`Requêtes restantes aujourd'hui : ${remaining}.`);

    const clubLinks = await db.select().from(externalLinks).where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "club")));
    const clubOf = new Map(clubLinks.map((l) => [l.externalId, l.entityId]));
    const matchLinks = await db.select().from(externalLinks).where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "match")));
    const matchOf = new Map(matchLinks.map((l) => [l.externalId, l.entityId]));
    const engaged = new Set(
      (await db.select({ clubId: competitionTeams.clubId }).from(competitionTeams).where(eq(competitionTeams.competitionId, competitionId))).map((t) => t.clubId),
    );
    const unmapped = new Set<string>();

    for (const f of data) {
      const home = clubOf.get(String(f.teams.home.id));
      const away = clubOf.get(String(f.teams.away.id));
      if (!home) unmapped.add(f.teams.home.name);
      if (!away) unmapped.add(f.teams.away.name);
      const status = mapExternalStatus(f.fixture.status.short);
      if (!home || !away || !status) {
        result.skipped++;
        continue;
      }
      const round = roundFromLabel(f.league.round);
      const kickoffAt = new Date(f.fixture.date);
      const venue = [f.fixture.venue?.name, f.fixture.venue?.city].filter(Boolean).join(", ") || null;
      const scored = status === "LIVE" || status === "HALF_TIME" || status === "FINISHED";
      const ext = { status, homeScore: scored ? f.goals.home : null, awayScore: scored ? f.goals.away : null };

      // Match déjà lié, sinon match du calendrier interne avec les mêmes équipes (non lié), sinon création.
      let matchId = matchOf.get(String(f.fixture.id));
      if (!matchId) {
        const [same] = await db
          .select({ id: matches.id })
          .from(matches)
          .where(and(eq(matches.competitionId, competitionId), eq(matches.homeClubId, home), eq(matches.awayClubId, away), eq(matches.round, round)))
          .limit(1);
        const taken = same && matchLinks.some((l) => l.entityId === same.id);
        if (same && !taken) {
          matchId = same.id;
        } else {
          const [created] = await db
            .insert(matches)
            .values({ competitionId, round, homeClubId: home, awayClubId: away, kickoffAt, venue, status: "SCHEDULED", scoreSource: "EXTERNAL" })
            .returning({ id: matches.id });
          matchId = created.id;
          result.created++;
        }
        await db.insert(externalLinks).values({ provider: PROVIDER, entity: "match", entityId: matchId, externalId: String(f.fixture.id) }).onConflictDoNothing();
        if (!engaged.has(home) || !engaged.has(away)) {
          await db.insert(competitionTeams).values([home, away].filter((c) => !engaged.has(c)).map((clubId) => ({ competitionId, clubId }))).onConflictDoNothing();
          engaged.add(home).add(away);
        }
      }

      const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      const [{ n: events }] = await db.select({ n: count() }).from(matchEvents).where(eq(matchEvents.matchId, matchId));
      const officialEntry = events > 0 || (m.scoreSource === "OFFICIAL" && m.status !== "SCHEDULED" && m.status !== "POSTPONED");
      const changes: Partial<typeof matches.$inferInsert> = { externalSyncedAt: new Date() };
      // Programmation officielle (date / stade saisis par un responsable) : jamais remplacée.
      if (m.updatedBy === null && (m.kickoffAt?.getTime() !== kickoffAt.getTime() || (venue && m.venue !== venue))) {
        Object.assign(changes, { kickoffAt, ...(venue && { venue }) });
      }
      const decision = decideExternalUpdate(
        { status: m.status, homeScore: m.homeScore, awayScore: m.awayScore, validatedAt: m.validatedAt, scoreSource: m.scoreSource, officialEntry },
        ext,
      );
      if (decision.action === "apply") {
        Object.assign(changes, { status: ext.status, homeScore: ext.homeScore, awayScore: ext.awayScore, scoreSource: "EXTERNAL" as const, validatedAt: null });
        result.updated++;
      } else if (decision.action === "conflict") {
        const [open] = await db
          .select({ id: externalConflicts.id })
          .from(externalConflicts)
          .where(and(eq(externalConflicts.matchId, matchId), isNull(externalConflicts.resolvedAt)))
          .limit(1);
        if (!open) {
          await db.insert(externalConflicts).values({
            matchId,
            provider: PROVIDER,
            officialValue: { status: m.status, score: [m.homeScore, m.awayScore] },
            externalValue: { status: ext.status, score: [ext.homeScore, ext.awayScore] },
            reason: decision.reason ?? "Écart entre les sources.",
          });
          result.conflicts++;
        }
      }
      await db.update(matches).set(changes).where(eq(matches.id, matchId));
      // Coupe : le vainqueur d'un match terminé passe au tour suivant.
      if (decision.action === "apply" && events === 0) await recomputeMatch(matchId);
    }

    if (unmapped.size) result.notes.push(`Équipes non associées à un club (ignorées) : ${[...unmapped].sort().join(", ")}.`);
    // Une compétition qui reçoit des scores n'est plus « en préparation ».
    if (result.created || result.updated) await db.update(competitions).set({ status: "ONGOING" }).where(and(eq(competitions.id, competitionId), eq(competitions.status, "DRAFT")));
  } catch (e) {
    result.error = e instanceof ExternalApiError ? e.message : `Erreur inattendue : ${(e as Error).message}`;
  }
  await db
    .update(externalSyncRuns)
    .set({ finishedAt: new Date(), created: result.created, updated: result.updated, conflicts: result.conflicts, skipped: result.skipped, error: result.error, notes: result.notes })
    .where(eq(externalSyncRuns.id, run.id));
  return result;
}

/** Toutes les compétitions liées (appel planifié). */
export async function syncAllLinked(trigger: "manual" | "cron") {
  const linked = await db
    .select({ id: externalLinks.entityId })
    .from(externalLinks)
    .innerJoin(competitions, eq(competitions.id, externalLinks.entityId))
    .where(and(eq(externalLinks.provider, PROVIDER), eq(externalLinks.entity, "competition"), inArray(competitions.status, ["DRAFT", "ONGOING"])));
  const results = [];
  for (const c of linked) results.push(await syncCompetition(c.id, trigger));
  return results;
}
