import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { licenseTone, StatusBadge } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import {
  CATEGORY_LABELS,
  effectiveStatus,
  LICENSE_STATUS_LABELS,
  LICENSE_TYPE_LABELS,
  seasonLabel,
} from "@/lib/licenses";
import { DOCUMENT_TYPES, LICENSE_REQUIRED_DOCUMENTS } from "@/lib/documents";
import { hasDocuments } from "@/lib/queries/documents";
import { loadLicenseFor, validConsentExists } from "@/lib/queries/players";
import { applyLicenseAction } from "../actions";
import { payLicenseFee } from "../payment-actions";
import { ActionForm } from "@/components/admin/action-form";

export const metadata: Metadata = { title: "Licence — FECOFOOT" };

export default async function LicensePage({ params }: PageProps<"/admin/licences/[id]">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const row = await loadLicenseFor(user, id);
  if (!row) notFound();
  const { license, player, club } = row;

  const status = effectiveStatus(license.status, license.expiresAt);
  const [consentOk, docs] = await Promise.all([
    validConsentExists(player.id, club.id),
    hasDocuments("player", player.id, LICENSE_REQUIRED_DOCUMENTS),
  ]);
  const canDecide = can(user.role, "licenses.validate") && status !== "EXPIRED";
  const canPayOnline = status === "PENDING" && license.feeAmount > 0;
  const act = (a: Parameters<typeof applyLicenseAction>[1]) => applyLicenseAction.bind(null, license.id, a);

  const checks = [
    { label: "Droits de licence encaissés", ok: license.paidAt !== null },
    { label: "Accord en ligne du joueur / représentant légal", ok: consentOk },
    { label: "Visite médicale renseignée", ok: true },
    ...LICENSE_REQUIRED_DOCUMENTS.map((t) => ({ label: DOCUMENT_TYPES[t].label, ok: docs[t] })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Licences · saison ${seasonLabel(license.season)}`}
        title={license.number}
        description={`Déposée le ${formatDateTime(license.createdAt)}`}
        actions={
          status === "VALIDATED" && (
            <Link href={`/admin/licences/${license.id}/carte`} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Carte de licence
            </Link>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <p>
            <StatusBadge tone={licenseTone(status)}>{LICENSE_STATUS_LABELS[status]}</StatusBadge>
            {license.decisionReason && <span className="ml-2 text-sm text-muted-foreground">Motif : {license.decisionReason}</span>}
          </p>

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Joueur", <Link key="p" href={`/admin/joueurs/${player.id}`} className="font-medium underline-offset-2 hover:underline">{player.lastName} {player.firstName}</Link>],
                ["Identifiant fédéral", player.federalId],
                ["Club", club.name],
                ["Catégorie", CATEGORY_LABELS[license.category]],
                ["Type", LICENSE_TYPE_LABELS[license.type]],
                ["Visite médicale", formatDate(license.medicalCheckDate)],
                ["Droits", formatFcfa(license.feeAmount)],
                ["Encaissement", license.paidAt ? `${formatDateTime(license.paidAt)}${license.paymentRef ? ` · réf. ${license.paymentRef}` : ""}` : "—"],
                ["Validation", formatDateTime(license.validatedAt)],
                ["Expiration", formatDateTime(license.expiresAt)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Conditions de validation</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? "" : "text-destructive"}>
                {c.ok ? "✓" : "✗"} {c.label}
              </li>
            ))}
          </ul>

          {canPayOnline && (
            <div className="mt-2 flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider">Payer par Mobile Money</h2>
              <ActionForm
                action={payLicenseFee.bind(null, license.id)}
                label={`Payer ${formatFcfa(license.feeAmount)}`}
                variant="default"
                field={{ name: "phone", label: "Numéro Airtel Money ou MTN MoMo", required: true }}
              />
            </div>
          )}

          {canDecide && (
            <div className="mt-2 flex flex-col gap-3">
              {status === "PENDING" && (
                <ActionForm action={act("pay")} label="Enregistrer l'encaissement" field={{ name: "paymentRef", label: "Référence du paiement (facultatif)" }} />
              )}
              {status === "PAID" && <ActionForm action={act("validate")} label="Valider la licence" variant="default" />}
              {(status === "PENDING" || status === "PAID") && (
                <ActionForm action={act("reject")} label="Rejeter" variant="destructive" field={{ name: "reason", label: "Motif du rejet", required: true }} />
              )}
              {status === "VALIDATED" && (
                <ActionForm action={act("suspend")} label="Suspendre" variant="destructive" field={{ name: "reason", label: "Motif de la suspension", required: true }} />
              )}
              {status === "SUSPENDED" && <ActionForm action={act("reactivate")} label="Réactiver" />}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
