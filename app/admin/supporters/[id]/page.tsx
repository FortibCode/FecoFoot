import type { Metadata } from "next";
import { desc, eq, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { memberships, supporterPoints, supporters } from "@/lib/db/schema";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { formatCongoPhone, ID_DOCUMENT_LABELS, MEMBERSHIP_TIER_LABELS } from "@/lib/supporters";
import { UploadForm } from "@/components/admin/upload-form";
import { supporterPhotoUrl } from "@/lib/supporter-photo";
import { banSupporter, liftBan, markIdVerified, uploadSupporterPhoto } from "../actions";

export const metadata: Metadata = { title: "Supporter — FECOFOOT" };

export default async function AdminSupporterPage({ params }: PageProps<"/admin/supporters/[id]">) {
  await requirePermission("ticketing.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [s] = await db.select().from(supporters).where(eq(supporters.id, id)).limit(1);
  if (!s) notFound();
  const [history, [{ points }]] = await Promise.all([
    db.select().from(memberships).where(eq(memberships.supporterId, id)).orderBy(desc(memberships.createdAt)),
    db.select({ points: sum(supporterPoints.points) }).from(supporterPoints).where(eq(supporterPoints.supporterId, id)),
  ]);

  const photo = supporterPhotoUrl(s);

  return (
    <>
      <PageHeader eyebrow={`Supporters · ${s.fanId}`} title={`${s.lastName} ${s.firstName}`} description={`Inscrit le ${formatDateTime(s.createdAt)}`} />
      <div className="flex flex-col gap-8">
        <dl className="grid max-w-2xl gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Téléphone Mobile Money", formatCongoPhone(s.phone)],
              ["Date de naissance", formatDate(s.birthDate)],
              ["Pièce d'identité", `${ID_DOCUMENT_LABELS[s.idDocumentType]} n° ${s.idDocumentNumber}`],
              ["Pièce vérifiée", s.idVerifiedAt ? formatDateTime(s.idVerifiedAt) : "Non"],
              ["E-mail", s.email ?? "—"],
              ["Points de fidélité", String(Number(points ?? 0))],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-3 border-t pt-6" aria-label="Photo et pièce d'identité">
          <h2 className="font-semibold">Photo et pièce d&apos;identité</h2>
          <div className="flex flex-wrap items-start gap-4">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- image privée servie par une route authentifiée
              <img src={photo} alt={`Photo de ${s.firstName} ${s.lastName}`} className="h-36 w-28 rounded-md border object-cover" />
            ) : (
              <p className="flex h-36 w-28 items-center justify-center rounded-md border text-center text-xs text-muted-foreground">Pas de photo</p>
            )}
            <div className="flex flex-col gap-3">
              <UploadForm action={uploadSupporterPhoto.bind(null, id)} accept="image/jpeg,image/png,image/webp" label={photo ? "Remplacer la photo" : "Ajouter la photo"} />
              {photo && !s.idVerifiedAt && (
                <ActionForm action={markIdVerified.bind(null, id)} label="Pièce d'identité vérifiée sur présentation" />
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Interdiction de stade</h2>
          {s.banned ? (
            <>
              <p className="text-sm text-destructive">
                Interdit depuis le {formatDateTime(s.bannedAt)} — {s.banReason}
              </p>
              <ActionForm action={liftBan.bind(null, id)} label="Lever l'interdiction" />
            </>
          ) : (
            <ActionForm action={banSupporter.bind(null, id)} label="Prononcer une interdiction de stade" variant="destructive" field={{ name: "reason", label: "Motif", required: true }} />
          )}
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Adhésions</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {history.map((m) => (
              <li key={m.id} className="flex justify-between px-3 py-2">
                <span>
                  {seasonLabel(m.season)} · {MEMBERSHIP_TIER_LABELS[m.tier]} · {formatFcfa(m.price)}
                </span>
                <span className="text-muted-foreground">{m.status === "ACTIVE" ? `Active depuis le ${formatDate(m.activatedAt)}` : m.status === "PENDING" ? "Paiement en attente" : "Annulée"}</span>
              </li>
            ))}
            {history.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucune adhésion.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
