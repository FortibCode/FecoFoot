import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, transferTone } from "@/components/admin/status-badge";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { transfers } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { transferQuery, transferScope } from "@/lib/queries/transfers";
import { needsRelease, TRANSFER_STATUS_LABELS, TRANSFER_TYPE_LABELS } from "@/lib/transfers";
import { answerRelease, applyTransferAction } from "../actions";

export const metadata: Metadata = { title: "Transfert — FECOFOOT" };

export default async function TransferPage({ params }: PageProps<"/admin/transferts/[id]">) {
  const user = await requireAnyPermission("transfers.review", "transfers.approve", "transfers.release");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [row] = await transferQuery().where(eq(transfers.id, id)).limit(1);
  if (!row) notFound();
  const scope = transferScope(user);
  if (scope && (await transferQuery().where(and(eq(transfers.id, id), scope)).limit(1)).length === 0) redirect("/admin/acces-refuse");
  const { transfer: t, player, fromClub, toClub } = row;

  const act = (a: Parameters<typeof applyTransferAction>[1]) => applyTransferAction.bind(null, t.id, a);
  // Une ligue n'instruit que les demandes vers son territoire.
  const canReview = can(user.role, "transfers.review") && (user.role !== "LEAGUE" || toClub.leagueId === user.leagueId);
  const canDecide = can(user.role, "transfers.approve");
  const releaseNeeded = needsRelease(t);
  const releaseLabel = !releaseNeeded ? "Non requis" : t.releaseGranted === null ? "En attente" : t.releaseGranted ? "Accordé" : "Refusé";
  // Le club quitté répond ; la fédération peut enregistrer une réponse reçue sur papier.
  const canRelease =
    releaseNeeded &&
    t.status === "PENDING" &&
    t.releaseGranted === null &&
    ((can(user.role, "transfers.release") && user.clubId === t.fromClubId) || canDecide);

  return (
    <>
      <PageHeader eyebrow={`Transferts · saison ${seasonLabel(t.season)}`} title={t.number} description={`Demande du ${formatDateTime(t.createdAt)}`} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <p>
            <StatusBadge tone={transferTone(t.status)}>{TRANSFER_STATUS_LABELS[t.status]}</StatusBadge>
          </p>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Joueur", <Link key="p" href={`/admin/joueurs/${player.id}`} className="font-medium underline-offset-2 hover:underline">{player.lastName} {player.firstName} ({player.federalId})</Link>],
                ["Type", TRANSFER_TYPE_LABELS[t.type]],
                ["Club quitté", fromClub?.name ?? "Sans club"],
                ["Club d'accueil", toClub.name],
                ["Indemnité", formatFcfa(t.fee)],
                ["Accord du club quitté", `${releaseLabel}${t.releaseReason ? ` — ${t.releaseReason}` : ""}${t.releaseAt ? ` (${formatDateTime(t.releaseAt)})` : ""}`],
                ["Fin du prêt", t.loanEndDate ? formatDate(t.loanEndDate) : "—"],
                ["Avis de la ligue", t.reviewOpinion ?? (t.reviewedAt ? "Favorable" : "—")],
                ["Instruit le", formatDateTime(t.reviewedAt)],
                ["Décision", t.decisionReason ?? "—"],
                ["Décidé le", formatDateTime(t.decidedAt)],
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
          {canRelease && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wider">Accord de sortie ({fromClub?.name})</h2>
              <ActionForm action={answerRelease.bind(null, t.id, true)} label="Donner l'accord de sortie" variant="default" field={{ name: "text", label: "Observation (facultatif)" }} />
              <ActionForm action={answerRelease.bind(null, t.id, false)} label="Refuser la sortie" variant="destructive" field={{ name: "text", label: "Motif du refus", required: true }} />
            </>
          )}
          {t.status === "PENDING" && canReview && (
            <ActionForm action={act("forward")} label="Transmettre à la fédération" variant="default" field={{ name: "text", label: "Avis de la ligue (facultatif)" }} />
          )}
          {t.status === "FORWARDED" && canDecide && (
            <ActionForm action={act("approve")} label="Approuver le transfert" variant="default" field={{ name: "text", label: "Observation (facultatif)" }} />
          )}
          {(t.status === "PENDING" || t.status === "FORWARDED") && canDecide && (
            <ActionForm action={act("refuse")} label="Refuser" variant="destructive" field={{ name: "text", label: "Motif du refus", required: true }} />
          )}
          {(t.status === "PENDING" || t.status === "FORWARDED") && canReview && (
            <ActionForm action={act("cancel")} label="Annuler la demande" field={{ name: "text", label: "Motif de l'annulation", required: true }} />
          )}
          {t.status === "APPROVED" && (
            <Link href={`/admin/transferts/${t.id}/certificat`} className="admin-btn admin-btn-primary">
              Certificat de sortie
            </Link>
          )}
          {t.status === "APPROVED" && (
            <p className="text-sm text-muted-foreground">
              Le joueur appartient désormais à {toClub.name}. Sa licence de la saison a été close : le club d&apos;accueil doit déposer une nouvelle demande de licence et
              obtenir l&apos;accord du joueur.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
