"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission, requirePermission, type CurrentUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { blockedMessage, deletePlayerRecord, playerBlockers } from "@/lib/deletion";
import { playerConsents, playerFederalSeq, players, users } from "@/lib/db/schema";
import {
  CATEGORIES,
  consentLinkExpiry,
  formatFederalId,
  identityKey,
  isMinor,
  LICENSE_TYPES,
  POSITIONS,
  seasonOf,
} from "@/lib/licenses";
import { notify, notifyMode } from "@/lib/notify";
import { appUrl } from "@/lib/qr";
import { isUniqueViolation, loadClubFor, loadPlayerFor } from "@/lib/queries/players";
import { nextVal } from "@/lib/sequences";
import { hashToken, randomToken } from "@/lib/tokens";
import { insertLicenseRequest } from "@/lib/license-requests";
import { sendPasswordLink } from "@/lib/auth/reset-link";

const optText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());
const optEmail = z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable());
const isoDate = z.iso.date({ error: "Date invalide." });

const PlayerSchema = z
  .object({
    lastName: z.string().trim().min(2, { error: "Nom requis." }).max(80),
    firstName: z.string().trim().min(2, { error: "Prénom requis." }).max(80),
    birthDate: isoDate,
    birthPlace: optText(120),
    gender: z.enum(["M", "F"], { error: "Sexe requis." }),
    nationality: z.string().trim().min(2).max(60).default("Congolaise"),
    position: z.preprocess(blankToNull, z.enum(POSITIONS).nullable()),
    phone: optText(32),
    email: optEmail,
    guardianName: optText(160),
    guardianPhone: optText(32),
    guardianEmail: optEmail,
    clubId: z.coerce.number({ error: "Club requis." }).int().positive({ error: "Club requis." }),
  })
  .superRefine((p, ctx) => {
    const birth = new Date(`${p.birthDate}T00:00:00Z`);
    const age = new Date().getUTCFullYear() - birth.getUTCFullYear();
    if (age < 5 || age > 60) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Date de naissance invraisemblable." });
    // Un mineur doit avoir un représentant légal joignable (EF-ACC-01).
    if (isMinor(birth)) {
      if (!p.guardianName) ctx.addIssue({ code: "custom", path: ["guardianName"], message: "Représentant légal obligatoire pour un mineur." });
      if (!p.guardianPhone && !p.guardianEmail) {
        ctx.addIssue({ code: "custom", path: ["guardianPhone"], message: "Téléphone ou e-mail du représentant légal requis." });
      }
    }
  });

type PlayerInput = z.infer<typeof PlayerSchema>;

function toRow(p: PlayerInput) {
  return {
    ...p,
    lastName: p.lastName.toUpperCase(),
    birthDate: new Date(`${p.birthDate}T00:00:00Z`),
    identityKey: identityKey(p.lastName, p.firstName, p.birthDate),
  };
}

async function duplicateOf(key: string, exceptId?: number) {
  const where = exceptId ? and(eq(players.identityKey, key), ne(players.id, exceptId)) : eq(players.identityKey, key);
  const [dup] = await db.select({ id: players.id, federalId: players.federalId }).from(players).where(where).limit(1);
  return dup;
}

async function checkClub(user: CurrentUser, clubId: number): Promise<string | null> {
  if (user.role === "CLUB" && user.clubId !== clubId) return "Vous ne pouvez enregistrer que les joueurs de votre club.";
  return (await loadClubFor(user, clubId)) ? null : "Club introuvable ou hors de votre périmètre.";
}

export async function createPlayer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("players.manage");
  const parsed = PlayerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const clubError = await checkClub(user, parsed.data.clubId);
  if (clubError) return { error: clubError };

  const row = toRow(parsed.data);
  const dup = await duplicateOf(row.identityKey);
  if (dup) {
    return { error: `Ce joueur est déjà enregistré sous l'identifiant ${dup.federalId} (même nom, prénom et date de naissance).` };
  }

  let created: { id: number; federalId: string };
  try {
    const year = new Date().getUTCFullYear();
    [created] = await db
      .insert(players)
      .values({ ...row, federalId: formatFederalId(year, await nextVal(playerFederalSeq)), createdBy: user.id })
      .returning({ id: players.id, federalId: players.federalId });
  } catch (e) {
    if (isUniqueViolation(e, "players_identity_uq")) return { error: "Ce joueur vient d'être enregistré par un autre utilisateur." };
    throw e;
  }

  await logAudit({ userId: user.id, action: "CREATE", entity: "player", entityId: created.id, details: { federalId: created.federalId } });
  revalidatePath("/admin/joueurs");
  redirect(`/admin/joueurs/${created.id}`);
}

export async function updatePlayer(playerId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("players.manage");
  const current = await loadPlayerFor(user, playerId);
  if (!current) return { error: "Joueur introuvable." };
  const parsed = PlayerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  // Le changement de club passe par un transfert (M06), pas par la fiche.
  if (parsed.data.clubId !== current.player.clubId) return { error: "Le changement de club se fait par un transfert." };

  const row = toRow(parsed.data);
  const dup = await duplicateOf(row.identityKey, playerId);
  if (dup) return { error: `Ces informations correspondent déjà au joueur ${dup.federalId}.` };

  await db
    .update(players)
    .set({ ...row, updatedAt: new Date() })
    .where(eq(players.id, playerId));
  await logAudit({ userId: user.id, action: "UPDATE", entity: "player", entityId: playerId });
  revalidatePath(`/admin/joueurs/${playerId}`);
  return { success: "Fiche du joueur mise à jour." };
}

// ─── Accord en ligne (M05) ───────────────────────────────────────────────────

export type ConsentRequestState = (ActionState & { link?: string }) | undefined;

/**
 * Le club envoie une demande d'accord ; si le joueur est mineur, elle va à son représentant légal
 * (EF-ACC-01). Une nouvelle demande annule la précédente (EF-ACC-02).
 */
export async function requestConsent(playerId: number): Promise<ConsentRequestState> {
  const user = await requirePermission("players.manage");
  const row = await loadPlayerFor(user, playerId);
  if (!row?.player.clubId) return { error: "Le joueur doit être rattaché à un club." };
  const { player } = row;
  const clubId = player.clubId!;

  const minor = isMinor(player.birthDate);
  const recipient = minor
    ? { recipient: "GUARDIAN" as const, recipientName: player.guardianName, recipientPhone: player.guardianPhone, recipientEmail: player.guardianEmail }
    : {
        recipient: "PLAYER" as const,
        recipientName: `${player.firstName} ${player.lastName}`,
        recipientPhone: player.phone,
        recipientEmail: player.email,
      };
  if (!recipient.recipientName || (!recipient.recipientPhone && !recipient.recipientEmail)) {
    return {
      error: minor
        ? "Renseignez d'abord le nom et le téléphone ou l'e-mail du représentant légal."
        : "Renseignez d'abord le téléphone ou l'e-mail du joueur.",
    };
  }

  const token = randomToken();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(playerConsents)
      .set({ status: "CANCELLED" })
      .where(and(eq(playerConsents.playerId, playerId), eq(playerConsents.clubId, clubId), eq(playerConsents.status, "PENDING")));
    await tx.insert(playerConsents).values({
      playerId,
      clubId,
      ...recipient,
      recipientName: recipient.recipientName!,
      tokenHash: hashToken(token),
      requestedAt: now,
      linkExpiresAt: consentLinkExpiry(now),
      requestedBy: user.id,
    });
  });

  await logAudit({
    userId: user.id,
    action: "CONSENT_REQUEST",
    entity: "player",
    entityId: playerId,
    details: { clubId, recipient: recipient.recipient },
  });
  revalidatePath(`/admin/joueurs/${playerId}`);

  // Envoi du lien personnel par SMS et e-mail (EF-ACC-06).
  const link = await appUrl(`/accord/${token}`);
  const who = minor ? `votre enfant ${player.firstName} ${player.lastName}` : "vous";
  const sent = await notify(
    { phone: recipient.recipientPhone, email: recipient.recipientEmail },
    {
      topic: "consent_request",
      subject: `FECOFOOT — accord pour la licence (${row.club?.name})`,
      sms: `FECOFOOT : le club ${row.club?.name} demande votre accord pour licencier ${who}. Répondez ici (valable 14 jours) : ${link}`,
      email: `Bonjour ${recipient.recipientName},\n\nLe club ${row.club?.name} demande votre accord pour licencier ${who} à la Fédération Congolaise de Football.\nPour répondre (accord ou refus), ouvrez ce lien personnel, valable 14 jours :\n\n${link}\n\nFédération Congolaise de Football`,
    },
  );
  const target = minor ? "au représentant légal" : "au joueur";
  if (!sent) return { error: `La demande est enregistrée mais l'envoi ${target} a échoué. Réessayez plus tard.` };
  // En développement (NOTIFY_MODE=log), rien ne part réellement : le lien est affiché pour les essais.
  return notifyMode() === "log"
    ? { success: `Demande envoyée ${target} (mode développement : message non envoyé, lien ci-dessous).`, link }
    : { success: `Demande envoyée ${target} par SMS et/ou e-mail. Le lien est valable 14 jours.` };
}

// ─── Demande de licence (EF-LIC-03, EF-LIC-04) ───────────────────────────────

const LicenseRequestSchema = z.object({
  category: z.enum(CATEGORIES, { error: "Catégorie requise." }),
  type: z.enum(LICENSE_TYPES, { error: "Type requis." }),
  medicalCheckDate: isoDate,
  feeAmount: z.coerce.number({ error: "Montant requis." }).int({ error: "Montant entier en FCFA." }).min(0).max(10_000_000),
});

export async function requestLicense(playerId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const row = await loadPlayerFor(user, playerId);
  if (!row?.player.clubId || !row.club) return { error: "Le joueur doit être rattaché à un club." };
  if (row.club.status !== "AFFILIATED") return { error: "Le club doit être affilié pour demander une licence." };

  const parsed = LicenseRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const created = await insertLicenseRequest({
    player: row.player,
    clubId: row.player.clubId,
    season: seasonOf(),
    category: parsed.data.category,
    type: parsed.data.type,
    medicalCheckDate: new Date(`${parsed.data.medicalCheckDate}T00:00:00Z`),
    feeAmount: parsed.data.feeAmount,
    requestedBy: user.id,
  });
  if ("error" in created) return { error: created.error, ...(created.field && { fieldErrors: { [created.field]: [created.error] } }) };

  await logAudit({ userId: user.id, action: "LICENSE_REQUEST", entity: "license", entityId: created.id, details: { number: created.number, playerId } });
  revalidatePath(`/admin/joueurs/${playerId}`);
  revalidatePath("/admin/licences");
  redirect(`/admin/licences/${created.id}`);
}

/** Suppression d'un joueur enregistré par erreur : refusée dès qu'il a une licence, un transfert, un match… */
export async function deletePlayer(playerId: number): Promise<ActionState> {
  const user = await requirePermission("players.manage");
  const row = await loadPlayerFor(user, playerId);
  if (!row) return { error: "Joueur introuvable." };
  const reasons = await playerBlockers(playerId);
  if (reasons.length) return { error: blockedMessage("Le joueur", reasons) };
  await deletePlayerRecord(playerId);
  await logAudit({ userId: user.id, action: "DELETE", entity: "player", entityId: playerId, details: { federalId: row.player.federalId } });
  revalidatePath("/admin/joueurs");
  return { success: "Joueur supprimé." };
}

/**
 * Ouvre l'espace personnel du joueur : compte « Joueur / joueuse » et lien pour choisir son mot de passe.
 * Réservé aux joueurs majeurs disposant d'une adresse e-mail ; l'accès d'un mineur (via son représentant
 * légal) reste à définir par la fédération.
 */
export async function openPlayerAccess(playerId: number): Promise<ActionState> {
  const user = await requirePermission("players.manage");
  const row = await loadPlayerFor(user, playerId);
  if (!row) return { error: "Joueur introuvable." };
  const { player } = row;
  if (player.userId) return { error: "L'accès est déjà ouvert." };
  if (isMinor(player.birthDate)) return { error: "Joueur mineur : l'accès en ligne d'un mineur n'est pas encore ouvert." };
  if (!player.email) return { error: "Renseignez d'abord l'adresse e-mail du joueur (identifiant de connexion)." };
  const email = player.email.toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "Un compte existe déjà avec cette adresse e-mail." };

  // Mot de passe aléatoire inconnu de tous : le joueur choisit le sien avec le lien reçu.
  const account = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(users)
      .values({ email, fullName: `${player.firstName} ${player.lastName}`, phone: player.phone, role: "PLAYER", passwordHash: await bcrypt.hash(randomToken(), 12) })
      .returning({ id: users.id, email: users.email, phone: users.phone, fullName: users.fullName });
    await tx.update(players).set({ userId: a.id }).where(eq(players.id, playerId));
    return a;
  });
  await sendPasswordLink(account, "welcome", 7 * 86_400_000);
  await logAudit({ userId: user.id, action: "PLAYER_ACCESS", entity: "player", entityId: playerId, details: { userId: account.id } });
  revalidatePath(`/admin/joueurs/${playerId}`);
  return { success: `Accès ouvert : un lien pour choisir son mot de passe a été envoyé à ${email}.` };
}
