import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { LicenseCard } from "@/components/licenses/license-card";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, competitions, licenses, matchEvents, matches, matchLineups, notifications, players, transfers } from "@/lib/db/schema";
import { licenseCardData } from "@/lib/queries/license-card";
import { formatDate, formatDateTime } from "@/lib/format";
import { cardIssued, CATEGORY_LABELS, LICENSE_STATUS_LABELS, POSITION_LABELS, seasonLabel } from "@/lib/licenses";
import { activeCaseSuspensions } from "@/lib/queries/discipline";
import { awayClub, homeClub } from "@/lib/queries/competitions";
import { transferQuery } from "@/lib/queries/transfers";
import { TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS } from "@/lib/transfers";

export const metadata: Metadata = { title: "Mon espace joueur — FECOFOOT" };

/**
 * Espace personnel du joueur : uniquement ses propres données (identité sportive, licences,
 * transferts, matchs disputés, suspensions en cours). Le compte est relié à une seule fiche joueur.
 */
export default async function PlayerSpacePage() {
  const user = await requirePermission("player.self");
  const [row] = await db
    .select({ player: players, club: clubs.name })
    .from(players)
    .leftJoin(clubs, eq(players.clubId, clubs.id))
    .where(eq(players.userId, user.id))
    .limit(1);
  if (!row) {
    return (
      <EmptyState icon="users" title="Aucune fiche joueur rattachée">
        Votre compte n’est relié à aucune fiche joueur. Contactez le secrétariat de votre club.
      </EmptyState>
    );
  }
  const { player } = row;

  const [licenseRows, moves, appearances, events, suspensions] = await Promise.all([
    db.select().from(licenses).where(eq(licenses.playerId, player.id)).orderBy(desc(licenses.season), desc(licenses.id)),
    transferQuery().where(eq(transfers.playerId, player.id)).orderBy(desc(transfers.createdAt)),
    db
      .select({ match: matches, competition: competitions.name, home: homeClub.name, away: awayClub.name, starter: matchLineups.starter })
      .from(matchLineups)
      .innerJoin(matches, eq(matchLineups.matchId, matches.id))
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(and(eq(matchLineups.playerId, player.id), eq(matches.status, "FINISHED")))
      .orderBy(desc(matches.kickoffAt))
      .limit(20),
    db
      .select({ type: matchEvents.type })
      .from(matchEvents)
      .innerJoin(matches, eq(matchEvents.matchId, matches.id))
      .where(and(eq(matchEvents.playerId, player.id), inArray(matches.status, ["FINISHED"]))),
    activeCaseSuspensions(),
  ]);
  // Carte : dernière licence délivrée (validée, puis éventuellement suspendue, révoquée ou expirée).
  const issued = licenseRows.find((l) => cardIssued(l.status));
  const [card, messages] = await Promise.all([
    issued ? licenseCardData(issued.id) : Promise.resolve(null),
    // Avis reçus au sujet de son dossier (SMS et e-mails envoyés à ses coordonnées).
    player.phone || player.email
      ? db
          .select({ id: notifications.id, channel: notifications.channel, subject: notifications.subject, topic: notifications.topic, createdAt: notifications.createdAt })
          .from(notifications)
          .where(and(or(...[player.phone, player.email].filter((x): x is string => Boolean(x)).map((c) => eq(notifications.recipient, c))), like(notifications.topic, "license%")))
          .orderBy(desc(notifications.createdAt))
          .limit(10)
      : Promise.resolve([]),
  ]);
  const goals = events.filter((e) => e.type === "GOAL" || e.type === "PENALTY_GOAL").length;
  const cards = events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD").length;
  const mine = suspensions.filter((s) => s.c.playerId === player.id);
  const current = licenseRows[0];

  return (
    <>
      <PageHeader
        eyebrow={`Mon espace joueur · ${player.federalId}`}
        title={`${player.firstName} ${player.lastName}`}
        description={`${row.club ?? "Sans club"} · ${player.position ? POSITION_LABELS[player.position] : "poste non renseigné"} · né(e) le ${formatDate(player.birthDate)}`}
      />
      <StatCards
        stats={[
          { label: "Licence", value: current ? seasonLabel(current.season) : "—", sub: current ? LICENSE_STATUS_LABELS[current.status] : "aucune licence" },
          { label: "Matchs disputés", value: appearances.length, sub: "feuilles de match officielles" },
          { label: "Buts", value: goals },
          { label: "Cartons", value: cards },
        ]}
      />
      <div className="flex flex-col gap-5">
        {mine.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2>Suspension en cours</h2>
            {mine.map((s) => (
              <p key={s.c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge tone="bad">Suspendu</StatusBadge>
                Décision du dossier {s.c.number}
                {s.c.suspensionMatches ? ` · ${s.c.suspensionMatches} match(s), ${s.played} déjà purgé(s)` : ""}
                {s.c.suspensionUntil ? ` · jusqu'au ${formatDate(new Date(s.c.suspensionUntil))}` : ""}
              </p>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2>Ma carte de licence</h2>
          {card ? (
            <>
              <LicenseCard data={card} />
              <div className="flex flex-wrap gap-2">
                <a href="/admin/espace-joueur/carte/pdf" className="admin-btn admin-btn-primary">
                  Télécharger ma carte (PDF)
                </a>
              </div>
            </>
          ) : (
            <EmptyState icon="document" title="Carte non délivrée" compact>
              La carte est disponible dès que la fédération a validé votre licence.
            </EmptyState>
          )}
        </section>

        {messages.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2>Notifications sur mon dossier</h2>
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {messages.map((n) => (
                <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span>{n.subject ?? "Message de la fédération"}</span>
                  <span className="text-xs text-muted-foreground">
                    {n.channel === "SMS" ? "SMS" : "E-mail"} · {formatDateTime(n.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2>Mes licences</h2>
          {licenseRows.length === 0 ? (
            <EmptyState icon="document" title="Aucune licence" compact>
              Votre club dépose la demande de licence de chaque saison.
            </EmptyState>
          ) : (
            <DataTable head={["N°", "Saison", "Catégorie", "Statut"]}>
              {licenseRows.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.number ?? "—"}</td>
                  <td>{seasonLabel(l.season)}</td>
                  <td>{CATEGORY_LABELS[l.category]}</td>
                  <td>
                    <StatusBadge tone={l.status === "VALIDATED" ? "ok" : l.status === "REJECTED" ? "bad" : "wait"}>{LICENSE_STATUS_LABELS[l.status]}</StatusBadge>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          {current?.status === "VALIDATED" && current.number && (
            <p className="text-sm text-muted-foreground">
              Authenticité vérifiable par tous :{" "}
              <Link href={`/verifier?numero=${encodeURIComponent(current.number)}`} className="underline">
                vérifier ma licence
              </Link>
              .
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Mes transferts</h2>
          {moves.length === 0 ? (
            <EmptyState icon="transfer" title="Aucun transfert" compact />
          ) : (
            <DataTable head={["Date", "Type", "De", "Vers", "Statut"]}>
              {moves.map((t) => (
                <tr key={t.transfer.id}>
                  <td>{formatDate(t.transfer.createdAt)}</td>
                  <td>{TRANSFER_TYPE_LABELS[t.transfer.type]}</td>
                  <td>{t.fromClub?.name ?? "—"}</td>
                  <td>{t.toClub.name}</td>
                  <td>{TRANSFER_STATUS_LABELS[t.transfer.status]}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Mes derniers matchs</h2>
          {appearances.length === 0 ? (
            <EmptyState icon="calendar" title="Aucun match disputé" compact>
              Les matchs apparaissent ici dès que vous figurez sur une feuille de match officielle.
            </EmptyState>
          ) : (
            <DataTable head={["Date", "Compétition", "Match", "Rôle"]} pageSize={5}>
              {appearances.map((a) => (
                <tr key={a.match.id}>
                  <td>{formatDateTime(a.match.kickoffAt)}</td>
                  <td>{a.competition}</td>
                  <td>
                    <Link href={`/matchs/${a.match.id}`}>
                      {a.home} {a.match.homeScore ?? "–"} – {a.match.awayScore ?? "–"} {a.away}
                    </Link>
                  </td>
                  <td>{a.starter ? "Titulaire" : "Remplaçant"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      </div>
    </>
  );
}
