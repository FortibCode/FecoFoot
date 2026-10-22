import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accreditations,
  auditLogs,
  clubs,
  competitions,
  disciplineCases,
  payments,
  licenses,
  matches,
  matchOfficials,
  players,
  referees,
  supporters,
  tickets,
  ticketOrders,
  transfers,
  users,
} from "@/lib/db/schema";
import { seasonOf } from "@/lib/licenses";
import { matchQuery } from "@/lib/queries/competitions";

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
    matchQuery()
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
    matchQuery()
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

  // Indicateurs complémentaires : dossiers à traiter, tendances sur 30 jours, évolution mensuelle, activité.
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [
    [{ accreditationsEnAttente }],
    [{ clubsTotal }],
    [{ paiementsReussis }],
    [{ paiementsEchoues }],
    [{ dossiersDiscipline }],
    [{ paiementsEnAttente }],
    [{ licences30j }],
    [{ supporters30j }],
    [{ encaisse30j }],
    licencesParMois,
    activite,
    [{ clubsEnAttente }],
    [{ resultatsAValider }],
    [{ matchsSansArbitre }],
    [{ billetsVendus30j }],
  ] = await Promise.all([
    db.select({ accreditationsEnAttente: count() }).from(accreditations).where(eq(accreditations.status, "PENDING")),
    db.select({ clubsTotal: count() }).from(clubs),
    db.select({ paiementsReussis: count() }).from(payments).where(and(eq(payments.status, "SUCCEEDED"), gte(payments.createdAt, thirtyDaysAgo))),
    db.select({ paiementsEchoues: count() }).from(payments).where(and(inArray(payments.status, ["FAILED", "EXPIRED"]), gte(payments.createdAt, thirtyDaysAgo))),
    db.select({ dossiersDiscipline: count() }).from(disciplineCases).where(eq(disciplineCases.status, "OPEN")),
    db.select({ paiementsEnAttente: count() }).from(payments).where(eq(payments.status, "PENDING")),
    db.select({ licences30j: count() }).from(licenses).where(and(eq(licenses.status, "VALIDATED"), gte(licenses.validatedAt, thirtyDaysAgo))),
    db.select({ supporters30j: count() }).from(supporters).where(gte(supporters.createdAt, thirtyDaysAgo)),
    db
      .select({ encaisse30j: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.status, "SUCCEEDED"), gte(payments.confirmedAt, thirtyDaysAgo))),
    // Licences validées par mois (6 derniers mois, heure de Brazzaville).
    db
      .select({
        mois: sql<string>`to_char(${licenses.validatedAt} at time zone 'Africa/Brazzaville', 'YYYY-MM')`,
        n: count(),
      })
      .from(licenses)
      .where(and(eq(licenses.status, "VALIDATED"), gte(licenses.validatedAt, sixMonthsAgo), lt(licenses.validatedAt, new Date(now.getTime() + 86_400_000))))
      .groupBy(sql`1`),
    // Dernières opérations (journal d'audit).
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, createdAt: auditLogs.createdAt, user: users.fullName })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      // Les connexions et déconnexions noieraient le reste : elles restent consultables dans le journal.
      .where(notInArray(auditLogs.action, ["LOGIN", "LOGOUT", "LOGIN_PASSWORD_OK"]))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(7),
    // Demandes d'affiliation de clubs à instruire.
    db.select({ clubsEnAttente: count() }).from(clubs).where(eq(clubs.status, "PENDING")),
    // Résultats saisis par un commissaire, pas encore validés : ils ne comptent pas au classement.
    db.select({ resultatsAValider: count() }).from(matches).where(and(eq(matches.status, "FINISHED"), sql`${matches.validatedAt} is null`)),
    // Matchs des 14 prochains jours sans arbitre central désigné.
    db
      .select({ matchsSansArbitre: count() })
      .from(matches)
      .where(
        and(
          eq(matches.status, "SCHEDULED"),
          gte(matches.kickoffAt, now),
          lt(matches.kickoffAt, new Date(now.getTime() + 14 * 86_400_000)),
          sql`not exists (select 1 from ${matchOfficials} where ${matchOfficials.matchId} = ${matches.id} and ${matchOfficials.role} = 'REFEREE')`,
        ),
      ),
    // Billets des commandes payées sur 30 jours.
    db
      .select({ billetsVendus30j: count() })
      .from(tickets)
      .innerJoin(ticketOrders, eq(tickets.orderId, ticketOrders.id))
      .where(and(eq(ticketOrders.status, "PAID"), gte(ticketOrders.paidAt, thirtyDaysAgo))),
  ]);
  const byMonth = new Map(licencesParMois.map((r) => [r.mois, r.n]));
  const fmtMois = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
  const evolution = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: fmtMois.format(d).replace(".", ""), value: byMonth.get(key) ?? 0 };
  });

  return {
    season,
    clubsEnAttente,
    resultatsAValider,
    matchsSansArbitre,
    billetsVendus30j,
    accreditationsEnAttente,
    clubsTotal,
    paiementsReussis,
    paiementsEchoues,
    dossiersDiscipline,
    paiementsEnAttente,
    licences30j,
    supporters30j,
    encaisse30j,
    evolution,
    activite,
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
