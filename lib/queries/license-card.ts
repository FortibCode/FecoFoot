import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { identityBadge, type BiometricCheckResult } from "@/lib/biometrics-rules";
import { db } from "@/lib/db";
import { auditLogs, biometricChecks, clubs, documents, licenses, players } from "@/lib/db/schema";
import { appUrl, qrSvg } from "@/lib/qr";

/** Joueurs créés par le jeu de données de démonstration (npm run demo:seed) : leur carte porte la mention « EXEMPLE ». */
async function isDemoPlayer(playerId: number) {
  const [row] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "DEMO_SEED"),
        sql`${auditLogs.details} -> 'players' @> ${JSON.stringify([playerId])}::jsonb`,
        sql`not exists (select 1 from audit_logs p where p.action = 'DEMO_PURGE' and p.id > ${auditLogs.id})`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Tout ce qu'affiche la carte de licence (recto, verso, PDF). L'appelant a déjà contrôlé l'accès.
 * La photo passe par /licences/photo/<jeton>, qui refait le contrôle d'accès à chaque demande.
 */
export async function licenseCardData(licenseId: number) {
  const [row] = await db
    .select({ license: licenses, player: players, club: clubs })
    .from(licenses)
    .innerJoin(players, eq(licenses.playerId, players.id))
    .innerJoin(clubs, eq(licenses.clubId, clubs.id))
    .where(eq(licenses.id, licenseId))
    .limit(1);
  if (!row) return null;
  const { license, player } = row;
  const verifyUrl = await appUrl(`/verifier/${license.verifyToken}`);
  const [[photo], [lastCheck], [logo], qr, demo] = await Promise.all([
    db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.ownerType, "player"), eq(documents.ownerId, player.id), eq(documents.type, "PLAYER_PHOTO")))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(1),
    db.select({ result: biometricChecks.result }).from(biometricChecks).where(eq(biometricChecks.playerId, player.id)).orderBy(desc(biometricChecks.checkedAt)).limit(1),
    db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.ownerType, "club"), eq(documents.ownerId, row.club.id), eq(documents.type, "CLUB_LOGO")))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(1),
    qrSvg(verifyUrl),
    isDemoPlayer(player.id),
  ]);
  return {
    ...row,
    photoUrl: photo ? `/licences/photo/${license.verifyToken}?v=${photo.id}` : null,
    photoDocId: photo?.id ?? null,
    clubLogoDocId: logo?.id ?? null,
    clubLogoUrl: logo && row.club.status === "AFFILIATED" ? `/media/clubs/${row.club.id}?v=${logo.id}` : null,
    qr,
    verifyUrl,
    identity: identityBadge(player, (lastCheck?.result as BiometricCheckResult | undefined) ?? null),
    demo,
  };
}

export type LicenseCardData = NonNullable<Awaited<ReturnType<typeof licenseCardData>>>;
