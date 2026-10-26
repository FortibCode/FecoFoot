import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { UploadForm } from "@/components/admin/upload-form";
import { requirePermission } from "@/lib/auth/guard";
import { ACCREDITATION_STATUS_LABELS, PRESS_ROLE_LABELS, PRESS_ZONE_LABELS, PRESS_ZONES, pressPhotoUrl } from "@/lib/accreditations";
import { db } from "@/lib/db";
import { accreditations, ticketEvents, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { formatCongoPhone } from "@/lib/supporters";
import { decideAccreditation, deleteAccreditationAndReturn, replaceAccreditationPhoto, updateAccreditation } from "../actions";
import { AccreditationForm, DecisionForm } from "../DecisionForm";

export const metadata: Metadata = { title: "Membre de la presse — FECOFOOT" };

/** Fiche d'un membre de la presse : photo, identité, décision, zones, entrées au stade, badge ; modification et suppression. */
export default async function AccreditationPage({ params }: PageProps<"/admin/accreditations/[id]">) {
  await requirePermission("communication.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db
    .select({ acc: accreditations, event: ticketEvents, decidedBy: users.fullName })
    .from(accreditations)
    .innerJoin(ticketEvents, eq(accreditations.eventId, ticketEvents.id))
    .leftJoin(users, eq(accreditations.decidedBy, users.id))
    .where(eq(accreditations.id, id))
    .limit(1);
  if (!row) notFound();
  const { acc, event, decidedBy } = row;
  const photo = pressPhotoUrl(acc);
  const who = `${acc.firstName} ${acc.lastName}`;
  const facts: [string, string][] = [
    ["N° d'accréditation", acc.number],
    ["Match", `${event.title} — ${formatDateTime(event.kickoffAt)}`],
    ["Média", acc.outlet],
    ["Fonction", PRESS_ROLE_LABELS[acc.role]],
    ["Carte de presse", acc.pressCardNumber],
    ["Téléphone", formatCongoPhone(acc.phone)],
    ["E-mail", acc.email ?? "—"],
    ["Demande reçue le", formatDateTime(acc.createdAt)],
    ["Décision", acc.decidedAt ? `${ACCREDITATION_STATUS_LABELS[acc.status]} le ${formatDateTime(acc.decidedAt)}${decidedBy ? ` par ${decidedBy}` : ""}` : "En attente"],
    ["Entrées au stade", acc.entries > 0 ? `${acc.entries}${acc.lastEntryAt ? ` (dernière le ${formatDateTime(acc.lastEntryAt)})` : ""}` : "Aucune"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Communication · Accréditations médias"
        title={who}
        description={`${acc.outlet} · ${PRESS_ROLE_LABELS[acc.role]}`}
        actions={
          <>
            <Link href={`/admin/accreditations?event=${acc.eventId}`} className="admin-btn admin-btn-outline">
              ← Accréditations du match
            </Link>
            {acc.status === "APPROVED" && (
              <Link href={`/accreditations/badge/${acc.badgeToken}`} target="_blank" className="admin-btn admin-btn-outline">
                Voir le badge
              </Link>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-8">
        <section className="flex flex-wrap items-start gap-6">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- photo servie par une route à accès contrôlé
            <img src={photo} alt={`Photo de ${who}`} className="aspect-[3/4] w-36 rounded-lg border object-cover" />
          ) : (
            <span className="grid aspect-[3/4] w-36 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">Sans photo</span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p>
              <StatusBadge tone={acc.status === "APPROVED" ? "ok" : acc.status === "REFUSED" ? "bad" : "wait"}>{ACCREDITATION_STATUS_LABELS[acc.status]}</StatusBadge>
              {acc.decisionReason && <span className="ml-2 text-sm text-muted-foreground">Motif : {acc.decisionReason}</span>}
            </p>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="font-medium [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
            <ul aria-label="Zones" className="flex flex-wrap gap-2 text-xs">
              {PRESS_ZONES.map((z) => {
                const granted = acc.grantedZones?.includes(z);
                const asked = acc.requestedZones.includes(z);
                return (
                  <li key={z} className={`rounded-full border px-3 py-1 ${granted ? "border-[var(--flag-green)] bg-[color-mix(in_oklch,var(--flag-green)_12%,transparent)] font-semibold" : asked ? "" : "text-muted-foreground line-through"}`}>
                    {PRESS_ZONE_LABELS[z]} · {granted ? "accordée" : asked ? "demandée" : "non demandée"}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2>{acc.status === "PENDING" ? "Décision" : acc.status === "APPROVED" ? "Zones accordées" : "Réexaminer la demande"}</h2>
          <p className="text-sm text-muted-foreground">
            {acc.status === "APPROVED"
              ? "Modifiez les zones dans le respect des quotas, ou retirez l'accréditation avec un motif : le journaliste est prévenu et le badge cesse d'être valable."
              : acc.status === "REFUSED"
                ? "La demande est refusée. Vous pouvez finalement l'approuver, dans le respect des quotas."
                : "Cochez les zones à accorder, ou refusez avec un motif."}
          </p>
          <DecisionForm
            approve={decideAccreditation.bind(null, acc.id, true)}
            refuse={decideAccreditation.bind(null, acc.id, false)}
            requested={acc.grantedZones ?? acc.requestedZones}
            who={who}
            approveLabel={acc.status === "APPROVED" ? "Enregistrer les zones" : "Approuver"}
            refuseLabel={acc.status === "APPROVED" ? "Retirer l'accréditation" : "Refuser"}
          />
        </section>

        <section id="modifier" className="flex flex-col gap-4">
          <h2>Modifier la fiche</h2>
          <AccreditationForm action={updateAccreditation.bind(null, acc.id)} initial={acc} />
        </section>

        <section className="flex flex-col gap-3">
          <h2>Photo du badge</h2>
          <UploadForm action={replaceAccreditationPhoto.bind(null, acc.id)} accept="image/jpeg,image/png" label={photo ? "Remplacer la photo" : "Ajouter la photo"} />
        </section>

        <section className="flex flex-col gap-3">
          <h2>Supprimer la demande</h2>
          <p className="text-sm text-muted-foreground">
            Pour un doublon ou une erreur de saisie. Impossible si le badge a déjà servi au stade : retirez alors l&apos;accréditation.
          </p>
          <RowActions name={`la demande de ${who}`} onDelete={deleteAccreditationAndReturn.bind(null, acc.id, acc.eventId)} />
        </section>
      </div>
    </>
  );
}
