"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission, requirePermission, type CurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { trainingRegistrations, trainings } from "@/lib/db/schema";
import { slugify } from "@/lib/format";
import { registrationError, TRAINING_ROLES, trainingDays } from "@/lib/programs";
import { isUniqueViolation } from "@/lib/queries/players";

const done = (trainingId?: number) => {
  revalidatePath("/admin/formations");
  if (trainingId) revalidatePath(`/admin/formations/${trainingId}`);
};

const TrainingSchema = z
  .object({
    title: z.string().trim().min(5, { error: "Titre requis." }).max(200),
    organizer: z.string().trim().min(2, { error: "Organisateur requis." }).max(120),
    location: z.string().trim().min(2, { error: "Lieu requis." }).max(160),
    startDate: z.iso.date({ error: "Date de début requise." }),
    endDate: z.iso.date({ error: "Date de fin requise." }),
    capacity: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(10_000).nullable()),
    description: z.preprocess(blankToNull, z.string().trim().max(3000).nullable()),
    modules: z.preprocess((v) => String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean), z.array(z.string().max(160)).max(30)),
    registrationOpen: z.preprocess((v) => v === "on", z.boolean()),
  })
  .refine((d) => d.endDate >= d.startDate, { error: "La fin précède le début.", path: ["endDate"] });

/** Nouvelle formation (organisation fédérale). */
export async function createTraining(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const parsed = TrainingSchema.safeParse({ ...Object.fromEntries(formData), registrationOpen: formData.get("registrationOpen") ?? "on" });
  if (!parsed.success) return fromZodError(parsed.error);
  let id: number;
  try {
    [{ id }] = await db
      .insert(trainings)
      .values({ ...parsed.data, slug: slugify(`${parsed.data.title} ${parsed.data.startDate}`) })
      .returning({ id: trainings.id });
  } catch (e) {
    if (isUniqueViolation(e, "trainings_slug_uq")) return { error: "Une formation de ce titre existe déjà à cette date." };
    throw e;
  }
  await logAudit({ userId: user.id, action: "CREATE", entity: "training", entityId: id, details: { title: parsed.data.title } });
  done();
  redirect(`/admin/formations/${id}`);
}

export async function updateTraining(trainingId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const parsed = TrainingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const updated = await db.update(trainings).set(parsed.data).where(eq(trainings.id, trainingId)).returning({ id: trainings.id });
  if (!updated.length) return { error: "Formation introuvable." };
  await logAudit({ userId: user.id, action: "UPDATE", entity: "training", entityId: trainingId, details: { title: parsed.data.title, registrationOpen: parsed.data.registrationOpen } });
  done(trainingId);
  return { success: "Formation mise à jour." };
}

const RegistrationSchema = z.object({
  fullName: z.string().trim().min(3, { error: "Nom complet requis." }).max(160),
  role: z.enum(TRAINING_ROLES, { error: "Fonction requise." }),
  clubId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  leagueId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  phone: z.preprocess(blankToNull, z.string().trim().max(32).nullable()),
  email: z.preprocess(blankToNull, z.email({ error: "Adresse e-mail invalide." }).nullable()),
});

/** Périmètre : un club inscrit ses dirigeants, une ligue son président ou ses dirigeants, la fédération tout le monde. */
function scoped(user: CurrentUser, data: z.infer<typeof RegistrationSchema>) {
  if (can(user.role, "programs.manage")) return data;
  if (user.role === "CLUB") return { ...data, clubId: user.clubId, leagueId: null, role: data.role === "LEAGUE_PRESIDENT" ? ("OTHER" as const) : data.role };
  if (user.role === "LEAGUE") return { ...data, clubId: null, leagueId: user.leagueId, role: data.role === "LEAGUE_PRESIDENT" ? data.role : ("OTHER" as const) };
  return null;
}

/** Inscription d'un dirigeant : places restantes, inscriptions ouvertes, pas de doublon (même nom, même structure). */
export async function registerDelegate(trainingId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const parsed = RegistrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const data = scoped(user, parsed.data);
  if (!data) return { error: "Inscription réservée aux clubs, aux ligues et à la fédération." };
  return db.transaction(async (tx) => {
    // Verrou de la formation : deux inscriptions simultanées ne dépassent pas le nombre de places.
    const [t] = await tx.select().from(trainings).where(eq(trainings.id, trainingId)).for("update").limit(1);
    if (!t) return { error: "Formation introuvable." };
    const [{ n }] = await tx.select({ n: count() }).from(trainingRegistrations).where(and(eq(trainingRegistrations.trainingId, trainingId), eq(trainingRegistrations.status, "REGISTERED")));
    const [dup] = await tx
      .select({ id: trainingRegistrations.id })
      .from(trainingRegistrations)
      .where(
        and(
          eq(trainingRegistrations.trainingId, trainingId),
          eq(trainingRegistrations.status, "REGISTERED"),
          sql`lower(${trainingRegistrations.fullName}) = lower(${data.fullName})`,
          data.clubId ? eq(trainingRegistrations.clubId, data.clubId) : data.leagueId ? eq(trainingRegistrations.leagueId, data.leagueId) : sql`true`,
        ),
      )
      .limit(1);
    const problem = registrationError({ open: t.registrationOpen, capacity: t.capacity, registered: n, duplicate: Boolean(dup), role: data.role, forClub: Boolean(data.clubId), forLeague: Boolean(data.leagueId) });
    if (problem) return { error: problem };
    const [row] = await tx.insert(trainingRegistrations).values({ ...data, trainingId, registeredBy: user.id }).returning({ id: trainingRegistrations.id });
    await logAudit({ userId: user.id, action: "TRAINING_REGISTER", entity: "training_registration", entityId: row.id, details: { trainingId, fullName: data.fullName, role: data.role } });
    done(trainingId);
    return { success: `${data.fullName} est inscrit(e).` };
  });
}

async function ownRegistration(user: CurrentUser, registrationId: number) {
  const [r] = await db.select().from(trainingRegistrations).where(eq(trainingRegistrations.id, registrationId)).limit(1);
  if (!r) return null;
  if (can(user.role, "programs.manage")) return r;
  if (user.role === "CLUB" && r.clubId !== null && r.clubId === user.clubId) return r;
  if (user.role === "LEAGUE" && r.leagueId !== null && r.leagueId === user.leagueId) return r;
  return null;
}

/** Désinscription (place libérée) ; l'inscription reste dans l'historique. */
export async function cancelRegistration(registrationId: number): Promise<ActionState> {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const r = await ownRegistration(user, registrationId);
  if (!r) return { error: "Inscription introuvable." };
  await db.update(trainingRegistrations).set({ status: "CANCELLED" }).where(and(eq(trainingRegistrations.id, registrationId), ne(trainingRegistrations.status, "CANCELLED")));
  await logAudit({ userId: user.id, action: "TRAINING_CANCEL", entity: "training_registration", entityId: registrationId });
  done(r.trainingId);
  return { success: "Inscription annulée." };
}

/** Présence d'un jour (pointage par la fédération), cochée ou décochée. */
export async function toggleAttendance(registrationId: number, day: string): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const [r] = await db.select().from(trainingRegistrations).where(eq(trainingRegistrations.id, registrationId)).limit(1);
  if (!r || r.status !== "REGISTERED") return { error: "Inscription introuvable." };
  const [t] = await db.select().from(trainings).where(eq(trainings.id, r.trainingId)).limit(1);
  if (!t || !trainingDays(t.startDate, t.endDate).includes(day)) return { error: "Jour hors de la formation." };
  const present = r.presentDays.includes(day) ? r.presentDays.filter((d) => d !== day) : [...r.presentDays, day].sort();
  await db.update(trainingRegistrations).set({ presentDays: present }).where(eq(trainingRegistrations.id, registrationId));
  await logAudit({ userId: user.id, action: "TRAINING_ATTENDANCE", entity: "training_registration", entityId: registrationId, details: { day, present: present.includes(day) } });
  done(r.trainingId);
  return { success: present.includes(day) ? "Présence enregistrée." : "Présence retirée." };
}
