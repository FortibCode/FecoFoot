import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { licenseTone, StatusBadge } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { biometricProvider } from "@/lib/biometrics";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DOCUMENT_TYPES, LICENSE_REQUIRED_DOCUMENTS } from "@/lib/documents";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { cardIssued, CATEGORY_LABELS, effectiveStatus, IDENTITY_METHOD_LABELS, LICENSE_STATUS_LABELS, LICENSE_TYPE_LABELS, seasonLabel } from "@/lib/licenses";
import { entityHistory } from "@/lib/queries/audit";
import { hasDocuments } from "@/lib/queries/documents";
import { loadLicenseFor, validConsentExists } from "@/lib/queries/players";
import { applyLicenseAction, resubmitLicense } from "../actions";
import { ValidateLicenseForm } from "../LicenseForms";
import { payLicenseFee } from "../payment-actions";

export const metadata: Metadata = { title: "Licence — FECOFOOT" };

const HISTORY_LABELS: Record<string, string> = {
  LICENSE_REQUEST: "Demande déposée",
  LICENSE_PAY: "Droits encaissés",
  LICENSE_VALIDATE: "Licence validée",
  LICENSE_REJECT: "Demande rejetée",
  LICENSE_CORRECT: "Corrections demandées",
  LICENSE_RESUBMIT: "Dossier soumis à nouveau",
  LICENSE_SUSPEND: "Licence suspendue",
  LICENSE_REACTIVATE: "Licence réactivée",
  LICENSE_REVOKE: "Licence révoquée",
  RENEW: "Renouvellement",
};

/** Dossier de licence : conditions, contrôle d'identité, décisions, carte, historique (EF-LIC-05 à EF-LIC-08). */
export default async function LicensePage({ params }: PageProps<"/admin/licences/[id]">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const row = await loadLicenseFor(user, id);
  if (!row) notFound();
  const { license, player, club } = row;

  const status = effectiveStatus(license.status, license.expiresAt);
  const [consentOk, docs, history, [verifier]] = await Promise.all([
    validConsentExists(player.id, club.id),
    hasDocuments("player", player.id, LICENSE_REQUIRED_DOCUMENTS),
    entityHistory("license", id),
    player.identityVerifiedBy ? db.select({ name: users.fullName }).from(users).where(eq(users.id, player.identityVerifiedBy)).limit(1) : Promise.resolve([]),
  ]);
  const canDecide = can(user.role, "licenses.validate") && status !== "EXPIRED";
  const canRevoke = can(user.role, "licenses.revoke") && (status === "VALIDATED" || status === "SUSPENDED");
  const canResubmit = status === "TO_CORRECT" && (can(user.role, "licenses.request") || can(user.role, "licenses.validate"));
  const canPayOnline = status === "PENDING" && license.feeAmount > 0;
  const act = (a: Parameters<typeof applyLicenseAction>[1]) => applyLicenseAction.bind(null, license.id, a);
  const identityVerified = player.identityVerifiedAt !== null;
  const biometrics = biometricProvider();

  const checks = [
    { label: "Droits de licence encaissés", ok: license.paidAt !== null },
    { label: "Accord en ligne du joueur / représentant légal", ok: consentOk },
    ...LICENSE_REQUIRED_DOCUMENTS.map((t) => ({ label: DOCUMENT_TYPES[t].label, ok: docs[t] })),
    { label: "Identité contrôlée par un agent", ok: identityVerified },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Licences · saison ${seasonLabel(license.season)}`}
        title={license.number}
        description={`${player.lastName} ${player.firstName} · ${club.name} · déposée le ${formatDateTime(license.createdAt)}`}
        actions={
          cardIssued(license.status) && (
            <>
              <Link href={`/admin/licences/${license.id}/carte`} className="admin-btn admin-btn-primary">
                Carte de licence
              </Link>
              <a href={`/admin/licences/${license.id}/carte/pdf`} className="admin-btn admin-btn-outline">
                PDF
              </a>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={licenseTone(status)}>{LICENSE_STATUS_LABELS[status]}</StatusBadge>
              {license.decisionReason && <span className="text-sm text-muted-foreground">Motif : {license.decisionReason}</span>}
            </p>
            {status === "TO_CORRECT" && (
              <p className="text-sm">
                Le club corrige la fiche du joueur ou ses pièces (
                <Link href={`/admin/joueurs/${player.id}`} className="underline">
                  fiche joueur
                </Link>
                ), puis soumet le dossier à nouveau.
              </p>
            )}
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["Joueur", <Link key="p" href={`/admin/joueurs/${player.id}`} className="font-medium underline-offset-2 hover:underline">{player.lastName} {player.firstName}</Link>],
                  ["Identifiant fédéral", player.federalId],
                  ["Club", club.name],
                  ["Catégorie", CATEGORY_LABELS[license.category]],
                  ["Type", LICENSE_TYPE_LABELS[license.type]],
                  ["Nationalité", player.nationality],
                  ["Visite médicale", formatDate(license.medicalCheckDate)],
                  ["Droits", formatFcfa(license.feeAmount)],
                  ["Encaissement", license.paidAt ? `${formatDateTime(license.paidAt)}${license.paymentRef ? ` · réf. ${license.paymentRef}` : ""}` : "—"],
                  ["Délivrance", formatDateTime(license.validatedAt)],
                  ["Expiration", formatDateTime(license.expiresAt)],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h2>Contrôle d&apos;identité</h2>
            {identityVerified ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge tone="ok">Identité vérifiée</StatusBadge>
                {player.identityMethod && IDENTITY_METHOD_LABELS[player.identityMethod]} le {formatDateTime(player.identityVerifiedAt)}
                {verifier && ` par ${verifier.name}`}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pas encore contrôlée. L&apos;agent confirme le contrôle sur pièces au moment de valider la licence ; la carte n&apos;affiche « Identité vérifiée » qu&apos;après ce
                contrôle.
              </p>
            )}
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <p className="font-semibold">Vérification biométrique</p>
              <p className="text-muted-foreground">
                {biometrics
                  ? `Prestataire « ${biometrics.id} » configuré : la capture se fait sur le poste équipé du lecteur.`
                  : "Non disponible : aucun prestataire biométrique n'est intégré. Aucune empreinte n'est collectée ni stockée par la plateforme."}
              </p>
            </div>
          </section>

          {history.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2>Historique du dossier</h2>
              <ol className="flex flex-col divide-y rounded-lg border text-sm">
                {history.map((h) => {
                  const d = (h.details ?? {}) as { reason?: string };
                  return (
                    <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                      <span>
                        <strong>{HISTORY_LABELS[h.action] ?? h.action}</strong>
                        {d.reason && <span className="text-muted-foreground"> — {d.reason}</span>}
                        <span className="text-muted-foreground"> · {h.user ?? "Système"}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <section className="flex flex-col gap-3">
            <h2>Conditions de validation</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? "" : "text-destructive"}>
                  {c.ok ? "✓" : "✗"} {c.label}
                </li>
              ))}
            </ul>
          </section>

          {canPayOnline && (
            <section className="flex flex-col gap-2">
              <h2>Payer par Mobile Money</h2>
              <ActionForm
                action={payLicenseFee.bind(null, license.id)}
                label={`Payer ${formatFcfa(license.feeAmount)}`}
                variant="default"
                field={{ name: "phone", label: "Numéro Airtel Money ou MTN MoMo", required: true }}
              />
            </section>
          )}

          {canResubmit && (
            <section className="flex flex-col gap-2">
              <h2>Dossier à corriger</h2>
              <ActionForm action={resubmitLicense.bind(null, license.id)} label="Soumettre à nouveau" variant="default" />
            </section>
          )}

          {(canDecide || canRevoke) && (
            <section className="flex flex-col gap-3">
              <h2>Décisions</h2>
              {canDecide && status === "PENDING" && (
                <ActionForm action={act("pay")} label="Enregistrer l'encaissement" field={{ name: "paymentRef", label: "Référence du paiement (facultatif)" }} />
              )}
              {canDecide && status === "PAID" && <ValidateLicenseForm action={act("validate")} identityVerified={identityVerified} />}
              {canDecide && (status === "PENDING" || status === "PAID") && (
                <ActionForm action={act("correct")} label="Demander des corrections" field={{ name: "reason", label: "Corrections attendues", required: true }} />
              )}
              {canDecide && (status === "PENDING" || status === "PAID" || status === "TO_CORRECT") && (
                <ActionForm action={act("reject")} label="Rejeter" variant="destructive" field={{ name: "reason", label: "Motif du rejet", required: true }} />
              )}
              {canDecide && status === "VALIDATED" && (
                <ActionForm action={act("suspend")} label="Suspendre" variant="destructive" field={{ name: "reason", label: "Motif de la suspension", required: true }} />
              )}
              {canDecide && status === "SUSPENDED" && <ActionForm action={act("reactivate")} label="Réactiver" />}
              {canRevoke && (
                <ActionForm action={act("revoke")} label="Révoquer définitivement" variant="destructive" field={{ name: "reason", label: "Motif de la révocation", required: true }} />
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
