"use server";

import { and, eq, like, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requirePermission, type CurrentUser } from "@/lib/auth/guard";
import { canAccessClub } from "@/lib/auth/roles";
import { CLUB_STATUSES, formatAffiliationNumber } from "@/lib/clubs";
import { db } from "@/lib/db";
import { clubAffiliationSeq, clubOfficials, clubs } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { nextVal } from "@/lib/sequences";

const optText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());

const ClubSchema = z.object({
  name: z.string().trim().min(2, { error: "Nom du club requis." }).max(160),
  shortName: optText(16),
  leagueId: z.coerce.number({ error: "Ligue requise." }).int().positive({ error: "Ligue requise." }),
  city: z.string().trim().min(2, { error: "Ville requise." }).max(120),
  stadium: optText(160),
  colors: optText(80),
  foundedYear: z.preprocess(
    blankToNull,
    z.coerce.number().int().min(1900, { error: "Année invalide." }).max(new Date().getFullYear(), { error: "Année invalide." }).nullable(),
  ),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  phone: optText(32),
});

/** Une ligue ne peut créer ou rattacher un club qu'à son propre territoire. */
function leagueAllowed(user: CurrentUser, leagueId: number) {
  return user.role !== "LEAGUE" || user.leagueId === leagueId;
}

async function loadClubFor(user: CurrentUser, clubId: number) {
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club || !canAccessClub(user, club)) redirect("/admin/acces-refuse");
  return club;
}

async function uniqueSlug(name: string, exceptId?: number) {
  const base = slugify(name) || "club";
  const where = exceptId
    ? and(like(clubs.slug, `${base}%`), ne(clubs.id, exceptId))
    : like(clubs.slug, `${base}%`);
  const taken = new Set((await db.select({ slug: clubs.slug }).from(clubs).where(where)).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createClub(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clubs.manage");
  const parsed = ClubSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!leagueAllowed(user, parsed.data.leagueId)) return { error: "Vous ne pouvez créer un club que dans votre ligue." };

  const [created] = await db
    .insert(clubs)
    .values({
      ...parsed.data,
      affiliationNumber: formatAffiliationNumber(await nextVal(clubAffiliationSeq)),
      slug: await uniqueSlug(parsed.data.name),
    })
    .returning({ id: clubs.id, affiliationNumber: clubs.affiliationNumber });

  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "club",
    entityId: created.id,
    details: { name: parsed.data.name, affiliationNumber: created.affiliationNumber },
  });
  revalidatePath("/admin/clubs");
  redirect(`/admin/clubs/${created.id}`);
}

export async function updateClub(clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clubs.manage");
  const club = await loadClubFor(user, clubId);
  const parsed = ClubSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  if (!leagueAllowed(user, parsed.data.leagueId)) return { error: "Vous ne pouvez pas rattacher ce club à une autre ligue." };

  const slug = parsed.data.name === club.name ? club.slug : await uniqueSlug(parsed.data.name, club.id);
  await db
    .update(clubs)
    .set({ ...parsed.data, slug, updatedAt: new Date() })
    .where(eq(clubs.id, club.id));
  await logAudit({ userId: user.id, action: "UPDATE", entity: "club", entityId: club.id });
  revalidatePath(`/admin/clubs/${club.id}`);
  return { success: "Fiche du club mise à jour." };
}

export async function setClubStatus(clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clubs.affiliate");
  const club = await loadClubFor(user, clubId);
  const parsed = z.enum(CLUB_STATUSES).safeParse(formData.get("status"));
  if (!parsed.success) return { error: "Statut invalide." };
  if (parsed.data === club.status) return { success: "Statut inchangé." };

  await db.update(clubs).set({ status: parsed.data, updatedAt: new Date() }).where(eq(clubs.id, club.id));
  await logAudit({
    userId: user.id,
    action: "STATUS_CHANGE",
    entity: "club",
    entityId: club.id,
    details: { from: club.status, to: parsed.data },
  });
  revalidatePath(`/admin/clubs/${club.id}`);
  revalidatePath("/admin/clubs");
  return { success: "Statut d'affiliation mis à jour." };
}

const OfficialSchema = z.object({
  fullName: z.string().trim().min(3, { error: "Nom complet requis." }).max(160),
  position: z.string().trim().min(2, { error: "Fonction requise." }).max(80),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
  phone: optText(32),
});

export async function addOfficial(clubId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("clubs.manage");
  const club = await loadClubFor(user, clubId);
  const parsed = OfficialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const [created] = await db
    .insert(clubOfficials)
    .values({ ...parsed.data, clubId: club.id })
    .returning({ id: clubOfficials.id });
  await logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "club_official",
    entityId: created.id,
    details: { clubId: club.id, position: parsed.data.position },
  });
  revalidatePath(`/admin/clubs/${club.id}`);
  return { success: "Dirigeant ajouté." };
}

export async function removeOfficial(clubId: number, officialId: number): Promise<void> {
  const user = await requirePermission("clubs.manage");
  const club = await loadClubFor(user, clubId);
  await db.delete(clubOfficials).where(and(eq(clubOfficials.id, officialId), eq(clubOfficials.clubId, club.id)));
  await logAudit({ userId: user.id, action: "DELETE", entity: "club_official", entityId: officialId, details: { clubId: club.id } });
  revalidatePath(`/admin/clubs/${club.id}`);
}
