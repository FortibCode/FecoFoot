"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { blankToNull, fromZodError, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireAnyPermission, requirePermission, type CurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubGrants, clubs, grantExpenses, grantNumberSeq } from "@/lib/db/schema";
import { MAX_FILE_SIZE, MIME, sniffKind } from "@/lib/documents";
import { notify } from "@/lib/notify";
import { formatGrantNumber, grantTransitionError, justification, type GrantAction } from "@/lib/programs";
import { nextVal } from "@/lib/sequences";
import { putFile } from "@/lib/storage";

const done = (grantId?: number) => {
  revalidatePath("/admin/subventions");
  if (grantId) revalidatePath(`/admin/subventions/${grantId}`);
};

/** Subvention visible par la fédération, ou par le club bénéficiaire (son propre dossier). */
async function grantFor(user: CurrentUser, grantId: number) {
  const [g] = await db.select().from(clubGrants).where(eq(clubGrants.id, grantId)).limit(1);
  if (!g) return null;
  if (can(user.role, "programs.manage")) return g;
  return user.role === "CLUB" && user.clubId === g.clubId ? g : null;
}

/** Pièce téléversée : PDF (conventions) ou PDF / photo (justificatifs), 5 Mo au plus, type vérifié d'après le contenu. */
async function readUpload(formData: FormData, kinds: readonly string[]) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier." } as const;
  if (file.size > MAX_FILE_SIZE) return { error: "Le fichier dépasse 5 Mo." } as const;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffKind(bytes);
  if (!kind || !kinds.includes(kind)) return { error: `Format non accepté : ${kinds.map((k) => k.toUpperCase()).join(", ")}.` } as const;
  return { bytes, kind, type: MIME[kind] } as const;
}

const GrantSchema = z.object({
  clubId: z.coerce.number({ error: "Choisissez un club." }).int().positive({ error: "Choisissez un club." }),
  trainingId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  programme: z.string().trim().min(3, { error: "Programme requis." }).max(160),
  amount: z.coerce.number({ error: "Montant requis." }).int().min(1, { error: "Montant requis." }).max(1_000_000_000),
  note: z.preprocess(blankToNull, z.string().trim().max(2000).nullable()),
});

/** Nouvelle subvention (fédération) : convention à déposer puis à faire signer par le club. */
export async function createGrant(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const parsed = GrantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const [club] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, parsed.data.clubId)).limit(1);
  if (!club) return { error: "Club introuvable." };
  const number = formatGrantNumber(new Date().getFullYear(), await nextVal(grantNumberSeq));
  const [g] = await db.insert(clubGrants).values({ ...parsed.data, number, createdBy: user.id }).returning({ id: clubGrants.id });
  await logAudit({ userId: user.id, action: "CREATE", entity: "club_grant", entityId: g.id, details: { number, clubId: parsed.data.clubId, amount: parsed.data.amount } });
  done();
  redirect(`/admin/subventions/${g.id}`);
}

/** Convention de la fédération (PDF), à signer par le club. */
export async function uploadConvention(grantId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const g = await grantFor(user, grantId);
  if (!g) return { error: "Subvention introuvable." };
  if (g.status !== "DRAFT") return { error: "La convention n'est plus modifiable." };
  const up = await readUpload(formData, ["pdf"]);
  if ("error" in up) return { error: up.error };
  const key = `grants/${grantId}/${randomUUID()}.pdf`;
  await putFile(key, up.bytes);
  await db.update(clubGrants).set({ conventionKey: key }).where(eq(clubGrants.id, grantId));
  await logAudit({ userId: user.id, action: "GRANT_CONVENTION", entity: "club_grant", entityId: grantId });
  done(grantId);
  return { success: "Convention déposée : le club peut la télécharger, la signer et la renvoyer." };
}

/** Convention signée par le club (PDF ou scan), déposée par le club ou par la fédération. */
export async function uploadSignedConvention(grantId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const g = await grantFor(user, grantId);
  if (!g) return { error: "Subvention introuvable." };
  if (g.status !== "DRAFT") return { error: "La convention est déjà validée." };
  if (!g.conventionKey) return { error: "La fédération n'a pas encore déposé la convention." };
  const up = await readUpload(formData, ["pdf", "jpeg", "png"]);
  if ("error" in up) return { error: up.error };
  const key = `grants/${grantId}/${randomUUID()}.${up.kind}`;
  await putFile(key, up.bytes);
  await db.update(clubGrants).set({ signedConventionKey: key }).where(eq(clubGrants.id, grantId));
  await logAudit({ userId: user.id, action: "GRANT_CONVENTION_SIGNED", entity: "club_grant", entityId: grantId });
  done(grantId);
  return { success: "Convention signée déposée : la fédération va la valider." };
}

/** Étapes décidées par la fédération : valider la signature, verser, clôturer, annuler. */
export async function applyGrantAction(grantId: number, action: GrantAction, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const g = await grantFor(user, grantId);
  if (!g) return { error: "Subvention introuvable." };
  const expenses = await db.select({ amount: grantExpenses.amount, status: grantExpenses.status }).from(grantExpenses).where(eq(grantExpenses.grantId, grantId));
  const problem = grantTransitionError(g.status, action, {
    hasConvention: Boolean(g.conventionKey),
    hasSignedConvention: Boolean(g.signedConventionKey),
    justified: justification(g.amount, expenses).accepted,
    amount: g.amount,
  });
  if (problem) return { error: problem };
  if (action === "sign") {
    await db.update(clubGrants).set({ status: "SIGNED", signedAt: new Date() }).where(eq(clubGrants.id, grantId));
  } else if (action === "pay") {
    const p = z.object({ paidAt: z.iso.date({ error: "Date du versement requise." }), paymentRef: z.string().trim().min(2, { error: "Référence du versement requise." }).max(80) }).safeParse(Object.fromEntries(formData));
    if (!p.success) return fromZodError(p.error);
    await db.update(clubGrants).set({ status: "PAID", ...p.data }).where(eq(clubGrants.id, grantId));
  } else if (action === "close") {
    await db.update(clubGrants).set({ status: "CLOSED", closedAt: new Date() }).where(eq(clubGrants.id, grantId));
  } else {
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3) return { error: "Indiquez le motif de l'annulation." };
    await db.update(clubGrants).set({ status: "CANCELLED", note: [g.note, `Annulée : ${reason}`].filter(Boolean).join("\n") }).where(eq(clubGrants.id, grantId));
  }
  await logAudit({ userId: user.id, action: `GRANT_${action.toUpperCase()}`, entity: "club_grant", entityId: grantId });
  done(grantId);
  return { success: { sign: "Convention validée.", pay: "Versement enregistré : le club doit maintenant justifier l'utilisation des fonds.", close: "Subvention clôturée.", cancel: "Subvention annulée." }[action] };
}

const ExpenseSchema = z.object({
  label: z.string().trim().min(3, { error: "Objet de la dépense requis." }).max(200),
  amount: z.coerce.number({ error: "Montant requis." }).int().min(1, { error: "Montant requis." }).max(1_000_000_000),
  spentOn: z.iso.date({ error: "Date de la dépense requise." }),
});

/** Justificatif de dépense (facture, reçu) : PDF ou photo, déposé une fois la subvention versée. */
export async function submitExpense(grantId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const g = await grantFor(user, grantId);
  if (!g) return { error: "Subvention introuvable." };
  if (g.status !== "PAID") return { error: "Les justificatifs se déposent une fois la subvention versée." };
  const parsed = ExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const up = await readUpload(formData, ["pdf", "jpeg", "png"]);
  if ("error" in up) return { error: up.error };
  const key = `expenses/${grantId}/${randomUUID()}.${up.kind}`;
  await putFile(key, up.bytes);
  const [e] = await db
    .insert(grantExpenses)
    .values({ ...parsed.data, grantId, documentKey: key, documentType: up.type, submittedBy: user.id })
    .returning({ id: grantExpenses.id });
  await logAudit({ userId: user.id, action: "GRANT_EXPENSE", entity: "grant_expense", entityId: e.id, details: { grantId, amount: parsed.data.amount } });
  done(grantId);
  return { success: "Justificatif déposé : il sera examiné par la fédération." };
}

/** Examen d'un justificatif par la fédération ; un refus est motivé et notifié au club. */
export async function reviewExpense(expenseId: number, accept: boolean, _state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("programs.manage");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!accept && !note) return { error: "Indiquez le motif du refus." };
  const [e] = await db.select().from(grantExpenses).where(eq(grantExpenses.id, expenseId)).limit(1);
  if (!e) return { error: "Justificatif introuvable." };
  await db
    .update(grantExpenses)
    .set({ status: accept ? "ACCEPTED" : "REJECTED", reviewNote: note, reviewedBy: user.id, reviewedAt: new Date() })
    .where(and(eq(grantExpenses.id, expenseId), eq(grantExpenses.status, "SUBMITTED")));
  if (!accept) {
    const [g] = await db.select({ number: clubGrants.number, email: clubs.email, phone: clubs.phone }).from(clubGrants).innerJoin(clubs, eq(clubs.id, clubGrants.clubId)).where(eq(clubGrants.id, e.grantId)).limit(1);
    if (g)
      await notify(
        { phone: g.phone, email: g.email },
        {
          topic: "grant_expense_rejected",
          subject: `FECOFOOT — subvention ${g.number} : justificatif refusé`,
          sms: `FECOFOOT : justificatif « ${e.label} » refusé (subvention ${g.number}). Motif : ${note}`,
          email: `Le justificatif « ${e.label} » (${e.amount} FCFA) de la subvention ${g.number} est refusé.\nMotif : ${note}\n\nDéposez un nouveau justificatif depuis l'espace fédéral.`,
        },
      );
  }
  await logAudit({ userId: user.id, action: accept ? "GRANT_EXPENSE_ACCEPTED" : "GRANT_EXPENSE_REJECTED", entity: "grant_expense", entityId: expenseId, details: { note } });
  done(e.grantId);
  return { success: accept ? "Justificatif accepté." : "Justificatif refusé." };
}
