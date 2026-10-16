"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser, type CurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, licenses, players, transferNumberSeq, transfers, transferWindows } from "@/lib/db/schema";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { notify } from "@/lib/notify";
import { isUniqueViolation } from "@/lib/queries/players";
import { nextVal } from "@/lib/sequences";
import {
  formatTransferNumber,
  LICENSE_STATUSES_CLOSED_BY_TRANSFER,
  needsRelease,
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPES,
  transferRequestError,
  transferTransition,
  windowError,
  type TransferAction,
} from "@/lib/transfers";

const TransferSchema = z.object({
  federalId: z.string().trim().toUpperCase().regex(/^FCF-J-\d{4}-\d{6}$/, { error: "Identifiant fédéral invalide (ex. FCF-J-2026-000001)." }),
  toClubId: z.coerce.number({ error: "Club d'accueil requis." }).int().positive({ error: "Club d'accueil requis." }),
  type: z.enum(TRANSFER_TYPES, { error: "Type requis." }),
  fee: z.preprocess((v) => blankToNull(v) ?? 0, z.coerce.number().int({ error: "Montant entier en FCFA." })),
  loanEndDate: z.preprocess(blankToNull, z.iso.date({ error: "Date invalide." }).nullable()),
});

/** Une ligue n'instruit que les transferts vers un club de son territoire. */
async function destinationAllowed(user: CurrentUser, toClubId: number) {
  const [club] = await db.select({ leagueId: clubs.leagueId, status: clubs.status }).from(clubs).where(eq(clubs.id, toClubId)).limit(1);
  if (!club) return { error: "Club d'accueil introuvable." };
  if (user.role === "LEAGUE" && club.leagueId !== user.leagueId) return { error: "Vous ne pouvez saisir que des transferts vers un club de votre ligue." };
  if (club.status !== "AFFILIATED") return { error: "Le club d'accueil doit être affilié." };
  return { ok: true as const };
}

export async function createTransfer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("transfers.review");
  const parsed = TransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const t = parsed.data;

  const [player] = await db.select().from(players).where(eq(players.federalId, t.federalId)).limit(1);
  if (!player) return { error: "Aucun joueur avec cet identifiant fédéral.", fieldErrors: { federalId: ["Joueur introuvable."] } };

  const dest = await destinationAllowed(user, t.toClubId);
  if ("error" in dest) return { error: dest.error };

  const loanEndDate = t.loanEndDate ? new Date(`${t.loanEndDate}T00:00:00Z`) : null;
  const ruleError = transferRequestError({ type: t.type, fromClubId: player.clubId, toClubId: t.toClubId, fee: t.fee, loanEndDate });
  if (ruleError) return { error: ruleError };

  const season = seasonOf();
  const windows = await db.select().from(transferWindows).where(eq(transferWindows.season, season));
  const outOfWindow = windowError(t.type, windows);
  if (outOfWindow) return { error: outOfWindow };

  let created: { id: number; number: string };
  try {
    [created] = await db
      .insert(transfers)
      .values({
        number: formatTransferNumber(season, await nextVal(transferNumberSeq)),
        playerId: player.id,
        fromClubId: player.clubId,
        toClubId: t.toClubId,
        type: t.type,
        fee: t.fee,
        loanEndDate,
        season,
        createdBy: user.id,
      })
      .returning({ id: transfers.id, number: transfers.number });
  } catch (e) {
    if (isUniqueViolation(e, "transfers_one_active_uq")) return { error: "Un transfert est déjà en cours pour ce joueur." };
    throw e;
  }

  await logAudit({ userId: user.id, action: "CREATE", entity: "transfer", entityId: created.id, details: { number: created.number, playerId: player.id } });

  // Le club quitté est invité à donner son accord en ligne (EF-TRF-05).
  if (needsRelease({ type: t.type, fromClubId: player.clubId })) {
    const [from] = await db.select({ name: clubs.name, email: clubs.email, phone: clubs.phone }).from(clubs).where(eq(clubs.id, player.clubId!)).limit(1);
    const text = `FECOFOOT : demande ${created.number} (${TRANSFER_TYPE_LABELS[t.type].toLowerCase()}) de ${player.firstName} ${player.lastName}. Votre accord de sortie est attendu dans l'espace fédéral, rubrique Transferts.`;
    await notify({ email: from?.email, phone: from?.phone }, { topic: "transfer_release_request", subject: `FECOFOOT — accord de sortie demandé (${created.number})`, sms: text, email: `${text}\n\nSaison ${seasonLabel(season)}.\nFédération Congolaise de Football` });
  }
  revalidatePath("/admin/transferts");
  redirect(`/admin/transferts/${created.id}`);
}

/** Instruction (ligue), approbation / refus (fédération), annulation (EF-TRF-02, EF-TRF-03, RG-06). */
export async function applyTransferAction(
  transferId: number,
  action: TransferAction,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("transfers.review");
  const [transfer] = await db.select().from(transfers).where(eq(transfers.id, transferId)).limit(1);
  if (!transfer) return { error: "Transfert introuvable." };

  const result = transferTransition(transfer.status, action, { releaseGranted: transfer.releaseGranted, needsRelease: needsRelease(transfer) });
  if ("error" in result) return { error: result.error };
  if (!can(user.role, result.permission as "transfers.review" | "transfers.approve")) {
    return { error: "Cette décision revient à la fédération." };
  }
  if (user.role === "LEAGUE") {
    const [dest] = await db.select({ leagueId: clubs.leagueId }).from(clubs).where(eq(clubs.id, transfer.toClubId)).limit(1);
    if (dest?.leagueId !== user.leagueId) return { error: "Ce transfert relève d'une autre ligue." };
  }

  const text = z.string().trim().max(1000).safeParse(formData.get("text") ?? "").data ?? "";
  if ((action === "refuse" || action === "cancel") && text.length < 3) return { error: "Indiquez le motif." };

  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const set: Partial<typeof transfers.$inferInsert> = { status: result.to };
    if (action === "forward") Object.assign(set, { reviewOpinion: text || null, reviewedBy: user.id, reviewedAt: now });
    else Object.assign(set, { decisionReason: text || null, decidedBy: user.id, decidedAt: now });

    // Mise à jour conditionnelle : échoue si le statut a changé entre-temps.
    const updated = await tx
      .update(transfers)
      .set(set)
      .where(and(eq(transfers.id, transferId), eq(transfers.status, transfer.status)))
      .returning({ id: transfers.id });
    if (updated.length === 0) return "conflict" as const;

    if (action === "approve") {
      // Le joueur rejoint le club d'accueil ; sa licence de la saison est close (RG-06).
      await tx.update(players).set({ clubId: transfer.toClubId, updatedAt: now }).where(eq(players.id, transfer.playerId));
      await tx
        .update(licenses)
        .set({ status: "TRANSFERRED", decisionReason: `Transfert ${transfer.number}`, updatedAt: now })
        .where(
          and(
            eq(licenses.playerId, transfer.playerId),
            eq(licenses.season, seasonOf(now)),
            inArray(licenses.status, [...LICENSE_STATUSES_CLOSED_BY_TRANSFER]),
          ),
        );
    }
    return "ok" as const;
  });
  if (outcome === "conflict") return { error: "Le transfert vient d'être modifié par un autre utilisateur. Rechargez la page." };

  await logAudit({
    userId: user.id,
    action: `TRANSFER_${action.toUpperCase()}`,
    entity: "transfer",
    entityId: transferId,
    details: { from: transfer.status, to: result.to, ...(text && { text }) },
  });
  revalidatePath(`/admin/transferts/${transferId}`);
  revalidatePath("/admin/transferts");
  revalidatePath(`/admin/joueurs/${transfer.playerId}`);
  return { success: "Transfert mis à jour." };
}

/** Accord (ou refus motivé) du club quitté (EF-TRF-05). La fédération peut l'enregistrer pour le compte du club. */
export async function answerRelease(transferId: number, granted: boolean, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [transfer] = await db.select().from(transfers).where(eq(transfers.id, transferId)).limit(1);
  if (!transfer || !transfer.fromClubId) return { error: "Transfert introuvable." };

  const isReleasingClub = can(user.role, "transfers.release") && user.clubId === transfer.fromClubId;
  if (!isReleasingClub && !can(user.role, "transfers.approve")) return { error: "Seul le club quitté peut répondre." };
  if (!needsRelease(transfer)) return { error: "Ce transfert ne nécessite pas d'accord du club quitté." };
  if (transfer.status !== "PENDING") return { error: "La demande n'est plus en instruction." };
  if (transfer.releaseGranted !== null) return { error: "Le club a déjà répondu." };

  const reason = z.string().trim().max(1000).safeParse(formData.get("text") ?? "").data ?? "";
  if (!granted && reason.length < 3) return { error: "Indiquez le motif du refus." };

  const updated = await db
    .update(transfers)
    .set({ releaseGranted: granted, releaseReason: reason || null, releaseBy: user.id, releaseAt: new Date() })
    .where(and(eq(transfers.id, transferId), eq(transfers.status, "PENDING"), isNull(transfers.releaseGranted)))
    .returning({ id: transfers.id });
  if (updated.length === 0) return { error: "Le club a déjà répondu." };

  await logAudit({
    userId: user.id,
    action: granted ? "TRANSFER_RELEASE_GRANTED" : "TRANSFER_RELEASE_REFUSED",
    entity: "transfer",
    entityId: transferId,
    details: { ...(reason && { reason }), onBehalf: !isReleasingClub },
  });
  revalidatePath(`/admin/transferts/${transferId}`);
  return { success: granted ? "Accord de sortie enregistré." : "Refus enregistré." };
}

// ─── Fenêtres de transfert (EF-TRF-04) ───────────────────────────────────────

const WindowSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Nom requis." }).max(80),
    season: z.coerce.number().int().min(2000).max(2100),
    opensOn: z.iso.date({ error: "Date d'ouverture invalide." }),
    closesOn: z.iso.date({ error: "Date de clôture invalide." }),
  })
  .refine((w) => w.opensOn <= w.closesOn, { error: "La clôture doit suivre l'ouverture.", path: ["closesOn"] });

export async function createTransferWindow(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("transfers.approve");
  const parsed = WindowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const w = parsed.data;
  const [created] = await db
    .insert(transferWindows)
    .values({ name: w.name, season: w.season, opensOn: new Date(`${w.opensOn}T00:00:00Z`), closesOn: new Date(`${w.closesOn}T00:00:00Z`) })
    .returning({ id: transferWindows.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "transfer_window", entityId: created.id, details: w });
  revalidatePath("/admin/transferts/fenetres");
  return { success: "Fenêtre enregistrée." };
}

export async function deleteTransferWindow(windowId: number): Promise<void> {
  const user = await requirePermission("transfers.approve");
  await db.delete(transferWindows).where(eq(transferWindows.id, windowId));
  await logAudit({ userId: user.id, action: "DELETE", entity: "transfer_window", entityId: windowId });
  revalidatePath("/admin/transferts/fenetres");
}
