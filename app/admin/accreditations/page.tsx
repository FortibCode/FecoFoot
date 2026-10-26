import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { StatCards } from "@/components/admin/stat-cards";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { ACCREDITATION_STATUS_LABELS, pressPhotoUrl, PRESS_ROLE_LABELS, PRESS_ZONE_LABELS, type PressZone } from "@/lib/accreditations";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { accreditationQuotas, accreditations, ticketEvents } from "@/lib/db/schema";
import { daysAgo, formatDateTime } from "@/lib/format";
import { formatCongoPhone } from "@/lib/supporters";
import { decideAccreditation, deleteAccreditation, saveQuotas } from "./actions";
import { DecisionForm, QuotaForm } from "./DecisionForm";

export const metadata: Metadata = { title: "Accréditations médias — FECOFOOT" };

/** Validation des accréditations par la communication (EF-MED-03, EF-MED-05). */
export default async function AdminAccreditationsPage({ searchParams }: PageProps<"/admin/accreditations">) {
  await requirePermission("communication.manage");
  const events = await db
    .select()
    .from(ticketEvents)
    .where(and(ne(ticketEvents.salesStatus, "DRAFT"), ne(ticketEvents.salesStatus, "CANCELLED")))
    .orderBy(asc(ticketEvents.kickoffAt));
  const upcoming = events.filter((e) => e.kickoffAt >= daysAgo(1));
  const raw = (await searchParams).event;
  const event = events.find((e) => e.id === Number(Array.isArray(raw) ? raw[0] : raw)) ?? upcoming[0] ?? events[0];

  if (!event) {
    return (
      <>
        <PageHeader eyebrow="Communication" title="Accréditations médias" />
        <EmptyState icon="press" title="Aucun match publié">Les demandes d’accréditation presse s’ouvrent pour les matchs mis en vente dans la billetterie.</EmptyState>
      </>
    );
  }
  const [requests, quotas] = await Promise.all([
    db.select().from(accreditations).where(eq(accreditations.eventId, event.id)).orderBy(asc(accreditations.status), desc(accreditations.createdAt)),
    db.select().from(accreditationQuotas).where(eq(accreditationQuotas.eventId, event.id)),
  ]);
  const quotaMap = Object.fromEntries(quotas.map((q) => [q.zone, q.quota])) as Partial<Record<PressZone, number>>;
  const approved = requests.filter((r) => r.status === "APPROVED");
  const kpis = [
    ["À traiter", requests.filter((r) => r.status === "PENDING").length],
    ["Approuvées", approved.length],
    ["Dont bord terrain (photo)", approved.filter((r) => r.grantedZones?.includes("PITCHSIDE")).length],
    ["Refusées", requests.filter((r) => r.status === "REFUSED").length],
  ] as const;

  return (
    <>
      <PageHeader eyebrow="Communication" title="Accréditations médias" description="Demandes des médias par match : validation, zones d'accès et badges." />
      <form className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex min-w-0 max-w-full flex-col gap-1.5 font-medium">
          Match
          <select name="event" defaultValue={event.id} className="h-10 w-full max-w-full min-w-0 rounded-md border px-2">
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {formatDateTime(e.kickoffAt)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="admin-btn admin-btn-outline">
          Afficher
        </button>
      </form>

      <StatCards testIdPrefix="acc-" stats={kpis.map(([label, n]) => ({ label, value: n }))} />

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="font-semibold">Quotas par zone</h2>
        <QuotaForm action={saveQuotas.bind(null, event.id)} quotas={quotaMap} />
      </section>

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:justify-between" data-testid={`acc-row-${r.number}`}>
            <div className="flex min-w-0 gap-4 text-sm">
              {/* Photo du badge, à contrôler avant validation (visage net, de face). */}
              {pressPhotoUrl(r) ? (
                <a href={pressPhotoUrl(r)!} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par une route à accès contrôlé */}
                  <img src={pressPhotoUrl(r)!} alt={`Photo de ${r.firstName} ${r.lastName}`} className="aspect-[3/4] w-16 rounded-md border object-cover" />
                </a>
              ) : (
                <span className="grid aspect-[3/4] w-16 shrink-0 place-items-center rounded-md border border-dashed text-center text-[0.6rem] text-muted-foreground">Sans photo</span>
              )}
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="font-semibold">
                  <Link href={`/admin/accreditations/${r.id}`} className="underline-offset-2 hover:underline">
                    {r.firstName} {r.lastName}
                  </Link>{" "}
                  <StatusBadge tone={r.status === "APPROVED" ? "ok" : r.status === "REFUSED" ? "bad" : "wait"}>{ACCREDITATION_STATUS_LABELS[r.status]}</StatusBadge>
                </p>
                <p className="text-muted-foreground">
                  {r.number} · {r.outlet} · {PRESS_ROLE_LABELS[r.role]} · carte {r.pressCardNumber}
                </p>
                <p className="text-muted-foreground">
                  {formatCongoPhone(r.phone)}
                  {r.email && ` · ${r.email}`} · reçue le {formatDateTime(r.createdAt)}
                </p>
                <p>
                  Demandées : {r.requestedZones.map((z) => PRESS_ZONE_LABELS[z]).join(", ")}
                  {r.grantedZones && <> · accordées : <strong>{r.grantedZones.map((z) => PRESS_ZONE_LABELS[z]).join(", ")}</strong></>}
                  {r.decisionReason && <> · motif : {r.decisionReason}</>}
                  {r.entries > 0 && <> · {r.entries} entrée(s) au stade</>}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <RowActions
                name={`${r.firstName} ${r.lastName}`}
                viewHref={`/admin/accreditations/${r.id}`}
                editHref={`/admin/accreditations/${r.id}#modifier`}
                onDelete={deleteAccreditation.bind(null, r.id)}
              />
              {r.status === "PENDING" && (
                <DecisionForm
                  approve={decideAccreditation.bind(null, r.id, true)}
                  refuse={decideAccreditation.bind(null, r.id, false)}
                  requested={r.requestedZones}
                  who={`${r.firstName} ${r.lastName}`}
                />
              )}
            </div>
          </li>
        ))}
        {requests.length === 0 && <li className="text-sm text-muted-foreground">Aucune demande pour ce match.</li>}
      </ul>
    </>
  );
}
