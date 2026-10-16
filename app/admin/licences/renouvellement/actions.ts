"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission } from "@/lib/auth/guard";
import { insertLicenseRequest } from "@/lib/license-requests";
import { seasonOf } from "@/lib/licenses";
import { loadClubFor } from "@/lib/queries/players";
import { renewalCandidates } from "@/lib/queries/renewal";

export type RenewalState = (ActionState & { created?: string[]; failed?: string[] }) | undefined;

/** Renouvellement groupé des licences d'un club d'une saison à l'autre (EF-LIC-10). */
export async function renewLicenses(clubId: number, _state: RenewalState, formData: FormData): Promise<RenewalState> {
  const user = await requireAnyPermission("licenses.request", "licenses.validate");
  const club = await loadClubFor(user, clubId);
  if (!club || (user.role === "CLUB" && user.clubId !== clubId)) return { error: "Club hors de votre périmètre." };
  if (club.status !== "AFFILIATED") return { error: "Le club doit être affilié pour demander des licences." };

  const selected = formData.getAll("playerIds").map(Number).filter(Number.isInteger);
  if (selected.length === 0) return { error: "Cochez au moins un joueur." };
  const fee = z.coerce.number().int().min(0).max(10_000_000).safeParse(formData.get("feeAmount"));
  if (!fee.success) return { error: "Montant des droits invalide (entier en FCFA)." };

  const season = seasonOf();
  // On ne renouvelle que des joueurs réellement éligibles (liste recalculée côté serveur).
  const candidates = new Map((await renewalCandidates(clubId, season)).map((c) => [c.playerId, c]));
  const created: string[] = [];
  const failed: string[] = [];

  for (const playerId of selected) {
    const c = candidates.get(playerId);
    if (!c) {
      failed.push(`Joueur n°${playerId} : non éligible au renouvellement.`);
      continue;
    }
    const name = `${c.lastName} ${c.firstName}`;
    const medical = String(formData.get(`medical_${playerId}`) ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(medical)) {
      failed.push(`${name} : date de visite médicale manquante.`);
      continue;
    }
    const result = await insertLicenseRequest({
      player: { id: playerId, birthDate: c.birthDate },
      clubId,
      season,
      category: c.category,
      type: c.type,
      medicalCheckDate: new Date(`${medical}T00:00:00Z`),
      feeAmount: fee.data,
      requestedBy: user.id,
    });
    if ("error" in result) failed.push(`${name} : ${result.error}`);
    else created.push(`${name} (${result.number})`);
  }

  if (created.length > 0) {
    await logAudit({ userId: user.id, action: "LICENSE_BULK_RENEWAL", entity: "club", entityId: clubId, details: { season, created: created.length, failed: failed.length } });
    revalidatePath("/admin/licences");
  }
  revalidatePath("/admin/licences/renouvellement");
  return {
    ...(created.length > 0 && { success: `${created.length} demande(s) de licence déposée(s).` }),
    ...(failed.length > 0 && { error: `${failed.length} demande(s) non déposée(s).` }),
    created,
    failed,
  };
}
