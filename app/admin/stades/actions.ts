"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { matches, stadiums } from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/queries/players";

const done = (id?: number) => {
  revalidatePath("/admin/stades");
  if (id) revalidatePath(`/admin/stades/${id}`);
  revalidatePath("/matchs", "layout");
};

const StadiumSchema = z.object({
  name: z.string().trim().min(3, { error: "Nom requis." }).max(160),
  city: z.string().trim().min(2, { error: "Ville requise." }).max(120),
  address: z.preprocess(blankToNull, z.string().trim().max(255).nullable()),
  capacity: z.preprocess(blankToNull, z.coerce.number().int().min(1, { error: "Capacité invalide." }).max(200_000, { error: "Capacité invalide." }).nullable()),
  surface: z.preprocess(blankToNull, z.string().trim().max(40).nullable()),
  openedYear: z.preprocess(blankToNull, z.coerce.number().int().min(1850, { error: "Année invalide." }).max(2100, { error: "Année invalide." }).nullable()),
  description: z.preprocess(blankToNull, z.string().trim().max(3000).nullable()),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

const DUPLICATE: ActionState = { error: "Un stade porte déjà ce nom dans cette ville.", fieldErrors: { name: ["Déjà enregistré dans cette ville."] } };

/** Nouveau stade (fiche publique sur la page des matchs qui s'y jouent). */
export async function createStadium(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const parsed = StadiumSchema.safeParse({ ...Object.fromEntries(formData), active: formData.get("active") ?? "on" });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const [{ id }] = await db.insert(stadiums).values(parsed.data).returning({ id: stadiums.id });
    await logAudit({ userId: user.id, action: "CREATE", entity: "stadium", entityId: id, details: { name: parsed.data.name, city: parsed.data.city } });
  } catch (e) {
    if (isUniqueViolation(e, "stadiums_name_city_uq")) return DUPLICATE;
    throw e;
  }
  done();
  return { success: "Stade enregistré." };
}

export async function updateStadium(stadiumId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const parsed = StadiumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const updated = await db
      .update(stadiums)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(stadiums.id, stadiumId))
      .returning({ id: stadiums.id });
    if (updated.length === 0) return { error: "Stade introuvable." };
  } catch (e) {
    if (isUniqueViolation(e, "stadiums_name_city_uq")) return DUPLICATE;
    throw e;
  }
  await logAudit({ userId: user.id, action: "UPDATE", entity: "stadium", entityId: stadiumId, details: { name: parsed.data.name, active: parsed.data.active } });
  done(stadiumId);
  return { success: "Stade mis à jour." };
}

/** Suppression d'un stade jamais utilisé ; un stade déjà relié à des matchs se désactive (historique conservé). */
export async function deleteStadium(stadiumId: number): Promise<ActionState> {
  const user = await requirePermission("competitions.manage");
  const [{ n }] = await db.select({ n: count() }).from(matches).where(eq(matches.stadiumId, stadiumId));
  if (n > 0) return { error: `Ce stade est relié à ${n} match${n > 1 ? "s" : ""} : désactivez-le plutôt que de le supprimer.` };
  await db.delete(stadiums).where(eq(stadiums.id, stadiumId));
  await logAudit({ userId: user.id, action: "DELETE", entity: "stadium", entityId: stadiumId });
  done();
  return { success: "Stade supprimé." };
}
