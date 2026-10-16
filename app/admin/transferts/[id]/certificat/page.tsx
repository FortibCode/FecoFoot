import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { requireAnyPermission } from "@/lib/auth/guard";
import { transfers } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { transferQuery, transferScope } from "@/lib/queries/transfers";
import { TRANSFER_TYPE_LABELS } from "@/lib/transfers";

export const metadata: Metadata = { title: "Certificat de sortie — FECOFOOT" };

/** Certificat de sortie en ligne (EF-TRF-05) : délivré pour un transfert approuvé. */
export default async function ReleaseCertificatePage({ params }: PageProps<"/admin/transferts/[id]/certificat">) {
  const user = await requireAnyPermission("transfers.review", "transfers.approve", "transfers.release");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const scope = transferScope(user);
  const [row] = await transferQuery()
    .where(scope ? and(eq(transfers.id, id), scope) : eq(transfers.id, id))
    .limit(1);
  if (!row) redirect("/admin/acces-refuse");
  const { transfer: t, player, fromClub, toClub } = row;
  if (t.status !== "APPROVED") return <p className="text-sm text-muted-foreground">Le certificat n&apos;est délivré qu&apos;après approbation du transfert.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PrintButton />
      </div>
      <article aria-label="Certificat de sortie" className="max-w-2xl border bg-white p-8 text-black print:border-0">
        <div className="mb-6 h-1.5 bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">Fédération Congolaise de Football</p>
        <h1 className="mt-1 text-2xl font-extrabold">Certificat de sortie</h1>
        <p className="mt-1 text-sm">N° {t.number} · saison {seasonLabel(t.season)}</p>

        <p className="mt-6 text-sm leading-relaxed">
          La Fédération Congolaise de Football certifie que le joueur <strong>{player.firstName} {player.lastName}</strong> (identifiant fédéral{" "}
          <strong>{player.federalId}</strong>) est libéré par le club <strong>{fromClub?.name ?? "—"}</strong> au profit du club{" "}
          <strong>{toClub.name}</strong>, au titre d&apos;un {TRANSFER_TYPE_LABELS[t.type].toLowerCase()}
          {t.type === "LOAN" && t.loanEndDate ? ` jusqu'au ${formatDate(t.loanEndDate)}` : ""}.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Indemnité</dt><dd>{formatFcfa(t.fee)}</dd></div>
          <div><dt className="text-gray-500">Accord du club quitté</dt><dd>{t.releaseAt ? formatDateTime(t.releaseAt) : "Non requis"}</dd></div>
          <div><dt className="text-gray-500">Avis de la ligue</dt><dd>{formatDateTime(t.reviewedAt)}</dd></div>
          <div><dt className="text-gray-500">Approbation fédérale</dt><dd>{formatDateTime(t.decidedAt)}</dd></div>
        </dl>
        <p className="mt-8 text-xs text-gray-500">
          Document délivré par la plateforme numérique de la FECOFOOT le {formatDateTime(new Date())}. Toute modification le rend nul.
        </p>
      </article>
    </div>
  );
}
