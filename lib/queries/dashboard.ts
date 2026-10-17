import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clubs,
  competitions,
  licenses,
  matches,
  players,
  referees,
  supporters,
  transfers,
  users,
} from "@/lib/db/schema";
import { seasonOf } from "@/lib/licenses";
import { homeClub, awayClub } from "@/lib/queries/competitions";

/**
 * Toutes les statistiques nécessaires au tableau de bord fédéral.
 * Exécutées en parallèle pour minimiser la latence.
 */
export async function dashboardStats() {
  const now = new Date();
  const season = seasonOf(now);

  // 30 jours en arrière pour les tendances
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ totalJoueurs }],
    [{ totalClubs }],
    [{ totalLicencesValidees }],
    [{ licencesEnAttente }],
    [{ transfertsEnCours }],
    [{ totalSupporters }],
    [{ totalUtilisateurs }],
    [{ competitionsActives }],
    [{ matchsJoues }],
    [{ arbitresActifs }],
    [{ joueursCeMois }],
    prochainsMatchs,
    derniersResultats,
    derniersTransferts,
  ] = await Promise.all([
    // Total joueurs inscrits
    db.select({ totalJoueurs: count() }).from(players),

    // Clubs affiliés
    db.select({ totalClubs: count() }).from(clubs).where(eq(clubs.status, "AFFILIATED")),

    // Licences validées cette saison
    db
      .select({ totalLicencesValidees: count() })
      .from(licenses)
      .where(and(eq(licenses.season, season), eq(licenses.status, "VALIDATED"))),

    // Licences en attente de validation
    db
      .select({ licencesEnAttente: count() })
      .from(licenses)
      .where(and(eq(licenses.season, season), inArray(licenses.status, ["PENDING", "PAID"]))),

    // Transferts en cours
    db
      .select({ transfertsEnCours: count() })
      .from(transfers)
      .where(inArray(transfers.status, ["PENDING", "FORWARDED"])),

    // Supporters Fan ID enregistrés
    db.select({ totalSupporters: count() }).from(supporters),

    // Utilisateurs de l'espace fédéral
    db.select({ totalUtilisateurs: count() }).from(users).where(eq(users.active, true)),

    // Compétitions actives (EN_COURS)
    db
      .select({ competitionsActives: count() })
      .from(competitions)
      .where(eq(competitions.status, "ONGOING")),

    // Matchs joués cette saison
    db
      .select({ matchsJoues: count() })
      .from(matches)
      .where(eq(matches.status, "FINISHED")),

    // Arbitres actifs
    db.select({ arbitresActifs: count() }).from(referees).where(eq(referees.active, true)),

    // Joueurs inscrits ce mois (tendance)
    db
      .select({ joueursCeMois: count() })
      .from(players)
      .where(gte(players.createdAt, thirtyDaysAgo)),

    // 5 prochains matchs programmés
    db
      .select({
        match: matches,
        competition: { id: competitions.id, name: competitions.name },
        home: { id: homeClub.id, name: homeClub.name, shortName: homeClub.shortName },
        away: { id: awayClub.id, name: awayClub.name, shortName: awayClub.shortName },
      })
      .from(matches)
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(
        and(
          eq(matches.status, "SCHEDULED"),
          gte(matches.kickoffAt, now),
          isNotNull(matches.homeClubId),
          isNotNull(matches.awayClubId),
        ),
      )
      .orderBy(asc(matches.kickoffAt))
      .limit(5),

    // 5 derniers résultats
    db
      .select({
        match: matches,
        competition: { id: competitions.id, name: competitions.name },
        home: { id: homeClub.id, name: homeClub.name, shortName: homeClub.shortName },
        away: { id: awayClub.id, name: awayClub.name, shortName: awayClub.shortName },
      })
      .from(matches)
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(eq(matches.status, "FINISHED"))
      .orderBy(desc(matches.kickoffAt))
      .limit(5),

    // 5 derniers transferts
    db
      .select({
        id: transfers.id,
        number: transfers.number,
        status: transfers.status,
        type: transfers.type,
        createdAt: transfers.createdAt,
        playerLastName: players.lastName,
        playerFirstName: players.firstName,
        toClubName: clubs.name,
      })
      .from(transfers)
      .innerJoin(players, eq(transfers.playerId, players.id))
      .innerJoin(clubs, eq(transfers.toClubId, clubs.id))
      .orderBy(desc(transfers.createdAt))
      .limit(5),
  ]);

  return {
    season,
    totalJoueurs,
    totalClubs,
    totalLicencesValidees,
    licencesEnAttente,
    transfertsEnCours,
    totalSupporters,
    totalUtilisateurs,
    competitionsActives,
    matchsJoues,
    arbitresActifs,
    joueursCeMois,
    prochainsMatchs,
    derniersResultats,
    derniersTransferts,
  };
}

export type DashboardStats = Awaited<ReturnType<typeof dashboardStats>>;
