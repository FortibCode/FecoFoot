"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { leagues } from "@/lib/db/schema";

const LeagueSchema = z.object({
  president: z.preprocess(blankToNull, z.string().trim().max(160).nullable()),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  phone: z.preprocess(blankToNull, z.string().trim().max(32).nullable()),
});

/** Les 12 ligues sont des données de référence : seuls le président et les contacts sont modifiables (EF-CLB-01). */
export async function updateLeague(leagueId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("leagues.manage");
  const parsed = LeagueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const updated = await db.update(leagues).set(parsed.data).where(eq(leagues.id, leagueId)).returning({ id: leagues.id });
  if (updated.length === 0) return { error: "Ligue introuvable." };

  await logAudit({ userId: user.id, action: "UPDATE", entity: "league", entityId: leagueId });
  revalidatePath("/admin/ligues");
  return { success: "Ligue mise à jour." };
}
