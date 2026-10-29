import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/admin/action-form";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { UploadForm } from "@/components/admin/upload-form";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubGrants, clubs, grantExpenses, trainings } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { EXPENSE_STATUS_LABELS, GRANT_STATUS_LABELS, justification } from "@/lib/programs";
import { applyGrantAction, reviewExpense, submitExpense, uploadConvention, uploadSignedConvention } from "../actions";
import { ExpenseForm, PayForm } from "../GrantForms";

export const metadata: Metadata = { title: "Subvention — FECOFOOT" };

const STEPS = [
  { key: "DRAFT", label: "Convention" },
  { key: "SIGNED", label: "Signée" },
  { key: "PAID", label: "Versée" },
  { key: "CLOSED", label: "Justifiée et clôturée" },
] as const;

/** Dossier d'une subvention : convention, signature, versement, justificatifs, clôture. */
export default async function GrantPage({ params }: PageProps<"/admin/subventions/[id]">) {
  const user = await requireAnyPermission("programs.manage", "programs.participate");
  const manage = can(user.role, "programs.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db
    .select({ g: clubGrants, club: clubs.name, training: trainings.title })
    .from(clubGrants)
    .innerJoin(clubs, eq(clubs.id, clubGrants.clubId))
    .leftJoin(trainings, eq(trainings.id, clubGrants.trainingId))
    .where(eq(clubGrants.id, id))
    .limit(1);
  if (!row || (!manage && !(user.role === "CLUB" && user.clubId === row.g.clubId))) notFound();
  const { g, club, training } = row;
  const expenses = await db.select().from(grantExpenses).where(eq(grantExpenses.grantId, id)).orderBy(desc(grantExpenses.createdAt));
  const j = justification(g.amount, expenses);
  const file = (doc: string, e?: number) => `/admin/subventions/${id}/fichier?doc=${doc}${e ? `&e=${e}` : ""}`;
  const stepIndex = g.status === "CANCELLED" ? -1 : STEPS.findIndex((s) => s.key === g.status);

  return (
    <>
      <PageHeader
        eyebrow={`Subvention ${g.number}`}
        title={club}
        description={`${GRANT_STATUS_LABELS[g.status]} · ${g.programme} · ${formatFcfa(g.amount)}${training ? ` · après « ${training} »` : ""}`}
        actions={
          <Link href="/admin/subventions" className="admin-btn admin-btn-outline">
            ← Subventions
          </Link>
        }
      />
      <div className="flex flex-col gap-8">
        {/* Étapes du dossier */}
        {g.status === "CANCELLED" ? (
          <p className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm">
            <strong>Subvention annulée.</strong> {g.note}
          </p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-4" aria-label="Étapes">
            {STEPS.map((s, i) => (
              <li key={s.key} className={`rounded-lg border px-3 py-2 text-sm ${i < stepIndex || g.status === "CLOSED" ? "border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_10%,transparent)]" : i === stepIndex ? "border-foreground font-semibold" : "text-muted-foreground"}`}>
                <span className="mr-2 font-bold tabular-nums">{i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>
        )}

        <section className="flex flex-col gap-3">
          <h2>Convention</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              Convention de la fédération :{" "}
              {g.conventionKey ? (
                <a href={file("convention")} target="_blank" rel="noreferrer" className="font-semibold underline">
                  télécharger
                </a>
              ) : (
                <span className="text-muted-foreground">pas encore déposée</span>
              )}
            </li>
            <li>
              Convention signée par le club :{" "}
              {g.signedConventionKey ? (
                <a href={file("signee")} target="_blank" rel="noreferrer" className="font-semibold underline">
                  voir
                </a>
              ) : (
                <span className="text-muted-foreground">en attente</span>
              )}
              {g.signedAt && <span className="text-muted-foreground"> · validée le {formatDateTime(g.signedAt)}</span>}
            </li>
          </ul>
          {g.status === "DRAFT" && (
            <div className="flex flex-wrap items-start gap-6">
              {manage && <UploadForm action={uploadConvention.bind(null, id)} accept="application/pdf" label={g.conventionKey ? "Remplacer la convention (PDF)" : "Déposer la convention (PDF)"} />}
              {g.conventionKey && <UploadForm action={uploadSignedConvention.bind(null, id)} accept="application/pdf,image/jpeg,image/png" label="Déposer la convention signée" />}
              {manage && <ActionForm action={applyGrantAction.bind(null, id, "sign")} label="Valider la convention signée" variant="default" />}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Versement</h2>
          {g.paidAt ? (
            <p className="text-sm">
              Versé le <strong>{formatDate(new Date(`${g.paidAt}T12:00:00`))}</strong> · référence <span className="font-mono">{g.paymentRef}</span>
            </p>
          ) : g.status === "SIGNED" && manage ? (
            <PayForm action={applyGrantAction.bind(null, id, "pay")} />
          ) : (
            <p className="text-sm text-muted-foreground">Le versement intervient après la validation de la convention signée.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2>Utilisation des fonds</h2>
          <div className="flex flex-col gap-1 text-sm">
            <p>
              Justifié : <strong>{formatFcfa(j.accepted)}</strong> sur {formatFcfa(g.amount)} ({j.rate} %) · en attente d&apos;examen : {formatFcfa(j.pending)} · reste à justifier :{" "}
              <strong>{formatFcfa(j.remaining)}</strong>
            </p>
            <div aria-hidden className="h-2 max-w-xl overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[var(--flag-green)]" style={{ width: `${j.rate}%` }} />
            </div>
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon="document" title="Aucun justificatif" compact />
          ) : (
            <DataTable head={["Date", "Objet", "Montant", "Pièce", "État", ""]}>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 tabular-nums">{formatDate(new Date(`${e.spentOn}T12:00:00`))}</td>
                  <td className="px-3 py-2">{e.label}</td>
                  <td className="px-3 py-2 tabular-nums">{formatFcfa(e.amount)}</td>
                  <td className="px-3 py-2">
                    <a href={file("depense", e.id)} target="_blank" rel="noreferrer" className="underline">
                      Ouvrir
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={e.status === "ACCEPTED" ? "ok" : e.status === "REJECTED" ? "bad" : "wait"}>{EXPENSE_STATUS_LABELS[e.status]}</StatusBadge>
                    {e.reviewNote && <span className="block text-xs text-muted-foreground">{e.reviewNote}</span>}
                  </td>
                  <td>
                    {manage && e.status === "SUBMITTED" && (
                      <div className="flex flex-wrap items-start gap-2">
                        <ActionForm action={reviewExpense.bind(null, e.id, true)} label="Accepter" variant="default" />
                        <ActionForm action={reviewExpense.bind(null, e.id, false)} label="Refuser" variant="destructive" field={{ name: "note", label: "Motif", required: true }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          {g.status === "PAID" && (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">Déposer un justificatif</h3>
              <ExpenseForm action={submitExpense.bind(null, id)} />
            </div>
          )}
        </section>

        {manage && (g.status === "PAID" || (g.status !== "CLOSED" && g.status !== "CANCELLED")) && (
          <section className="flex flex-col gap-3">
            <h2>Décisions</h2>
            <div className="flex flex-wrap items-start gap-4">
              {g.status === "PAID" && <ActionForm action={applyGrantAction.bind(null, id, "close")} label="Clôturer (fonds justifiés)" variant="default" />}
              <ActionForm action={applyGrantAction.bind(null, id, "cancel")} label="Annuler la subvention" variant="destructive" field={{ name: "reason", label: "Motif", required: true }} />
            </div>
          </section>
        )}
        {g.note && g.status !== "CANCELLED" && manage && <p className="text-xs whitespace-pre-line text-muted-foreground">Note interne : {g.note}</p>}
      </div>
    </>
  );
}
