import "server-only";
import { db } from "@/lib/db";
import { licenseNumberSeq, licenses } from "@/lib/db/schema";
import { categoryError, formatLicenseNumber, seasonExpiry, type Category, type LicenseType } from "@/lib/licenses";
import { isUniqueViolation } from "@/lib/queries/players";
import { nextVal } from "@/lib/sequences";
import { randomToken } from "@/lib/tokens";

/** Visite médicale obligatoire, de moins d'un an et pas dans le futur (EF-LIC-03). */
export function medicalCheckError(medical: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(medical.getTime())) return "Date de visite médicale invalide.";
  if (medical.getTime() > now.getTime()) return "La date de visite médicale ne peut pas être dans le futur.";
  if (now.getTime() - medical.getTime() > 365 * 24 * 60 * 60 * 1000) return "La visite médicale doit dater de moins d'un an.";
  return null;
}

/**
 * Dépôt d'une demande de licence : contrôles de visite médicale et de catégorie d'âge (EF-LIC-03, EF-LIC-04),
 * une licence par saison (RG-02, contrainte en base). Utilisé par la demande unitaire et le renouvellement groupé.
 */
export async function insertLicenseRequest(req: {
  player: { id: number; birthDate: Date };
  clubId: number;
  season: number;
  category: Category;
  type: LicenseType;
  medicalCheckDate: Date;
  feeAmount: number;
  requestedBy: number;
}): Promise<{ id: number; number: string } | { error: string; field?: "category" | "medicalCheckDate" }> {
  const medError = medicalCheckError(req.medicalCheckDate);
  if (medError) return { error: medError, field: "medicalCheckDate" };
  const catError = categoryError(req.player.birthDate, req.season, req.category);
  if (catError) return { error: catError, field: "category" };

  try {
    const [created] = await db
      .insert(licenses)
      .values({
        number: formatLicenseNumber(req.season, await nextVal(licenseNumberSeq)),
        playerId: req.player.id,
        clubId: req.clubId,
        season: req.season,
        category: req.category,
        type: req.type,
        medicalCheckDate: req.medicalCheckDate,
        feeAmount: req.feeAmount,
        expiresAt: seasonExpiry(req.season),
        verifyToken: randomToken(),
        requestedBy: req.requestedBy,
      })
      .returning({ id: licenses.id, number: licenses.number });
    return created;
  } catch (e) {
    if (isUniqueViolation(e, "licenses_player_season_uq")) return { error: "Ce joueur a déjà une licence pour cette saison." };
    throw e;
  }
}
