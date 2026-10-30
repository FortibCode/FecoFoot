"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { foundedYearError, SOCIAL_NETWORKS, socialUrlError } from "@/lib/site-settings";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Paramètres du portail : informations de la fédération (page « La Fédération ») et réseaux sociaux (pied de page). */
export async function updateSiteSettings(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communication.manage");
  const fieldErrors: Record<string, string[]> = {};
  const year = text(formData, "foundedYear");
  const yearError = foundedYearError(year, new Date().getFullYear());
  if (yearError) fieldErrors.foundedYear = [yearError];
  const headquarters = text(formData, "headquarters");
  if (headquarters.length > 240) fieldErrors.headquarters = ["240 caractères au plus."];
  const affiliations = text(formData, "affiliations");
  if (affiliations.length > 160) fieldErrors.affiliations = ["160 caractères au plus."];
  const urls = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, text(formData, n)])) as Record<(typeof SOCIAL_NETWORKS)[number], string>;
  for (const n of SOCIAL_NETWORKS) {
    const error = urls[n].length > 300 ? "300 caractères au plus." : socialUrlError(n, urls[n]);
    if (error) fieldErrors[n] = [error];
  }
  if (Object.keys(fieldErrors).length > 0) return { error: "Corrigez les champs signalés.", fieldErrors };

  const values = {
    foundedYear: year ? Number(year) : null,
    headquarters: headquarters || null,
    affiliations: affiliations || null,
    facebookUrl: urls.facebook || null,
    instagramUrl: urls.instagram || null,
    xUrl: urls.x || null,
    youtubeUrl: urls.youtube || null,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  await db.insert(siteSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: siteSettings.id, set: values });
  await logAudit({ userId: user.id, action: "UPDATE", entity: "site_settings", entityId: 1 });
  // Pied de page de toutes les pages publiques et page « La Fédération ».
  revalidatePath("/", "layout");
  return { success: "Paramètres enregistrés : le portail est à jour." };
}
