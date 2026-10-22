import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePermission } from "@/lib/auth/guard";
import { canAccessCompetition } from "@/lib/auth/roles";
import { COMPETITION_STATUS_LABELS } from "@/lib/competitions";
import { formatDate } from "@/lib/format";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { championshipByCode, championshipDocumentsOf, championshipOfficialsOf, championshipsWithSeasons } from "@/lib/queries/championships";
import { addOfficial, createSeason, deleteDocument, deleteOfficial, endMandate, updateChampionship, uploadDocument } from "../actions";
import { ChampionshipForm, DocumentForm, EndMandateForm, OfficialForm, SeasonForm } from "../ChampionshipForms";

export const metadata: Metadata = { title: "Championnat national — FECOFOOT" };

/** Fiche d'un championnat national : saisons (historique conservé), responsables, documents officiels. */
export default async function ChampionshipPage({ params }: PageProps<"/admin/championnats/[code]">) {
  const user = await requirePermission("competitions.manage");
  if (!canAccessCompetition(user, { leagueId: null })) redirect("/admin/acces-refuse");
  const ch = await championshipByCode((await params).code);
  if (!ch) notFound();
  const [all, officials, documents] = await Promise.all([championshipsWithSeasons(), championshipOfficialsOf(ch.id), championshipDocumentsOf(ch.id)]);
  const seasons = all.find((c) => c.id === ch.id)?.seasons ?? [];
  const latest = seasons[0]?.c.season;
  const suggested = latest ? latest + 1 : seasonOf();
  const active = officials.filter((o) => o.status === "ACTIVE");
  const ended = officials.filter((o) => o.status === "ENDED");

  return (
    <>
      <PageHeader
        eyebrow="Sport · Championnats nationaux"
        title={ch.name}
        description={`Niveau ${ch.tier} · ${seasons.length} saison(s)${ch.active ? "" : " · masqué du portail"}`}
        actions={
          <>
            <Link href="/admin/championnats" className="admin-btn admin-btn-outline">
              ← Championnats
            </Link>
            <Link href={`/championnats/${ch.code}`} className="admin-btn admin-btn-outline">
              Page publique
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <h2>Saisons</h2>
          <p className="text-sm text-muted-foreground">
            Chaque saison a ses clubs, ses zones ou groupes (poules), son format, son calendrier et ses montées et descentes. Les saisons passées restent consultables.
          </p>
          {seasons.length === 0 ? (
            <EmptyState icon="calendar" title="Aucune saison" compact>
              Créez la première saison ci-dessous, puis engagez les clubs et générez le calendrier.
            </EmptyState>
          ) : (
            <DataTable head={["Saison", "Nom", "Clubs", "Montées / descentes", "Statut", ""]} pageSize={5}>
              {seasons.map(({ c, teams }) => (
                <tr key={c.id} data-testid="season-row">
                  <td className="font-semibold">{seasonLabel(c.season)}</td>
                  <td>
                    <Link href={`/admin/competitions/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="tabular-nums">{teams}</td>
                  <td className="tabular-nums">
                    {c.promotionSpots} / {c.relegationSpots}
                  </td>
                  <td>
                    <StatusBadge tone={c.status === "ONGOING" ? "ok" : c.status === "DRAFT" ? "wait" : "neutral"}>{COMPETITION_STATUS_LABELS[c.status]}</StatusBadge>
                  </td>
                  <td>
                    <RowActions name={`${ch.name} ${seasonLabel(c.season)}`} viewHref={`/admin/competitions/${c.id}`} editHref={`/admin/competitions/${c.id}#modifier`} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section id="ajouter" className="flex flex-col gap-4">
          <h2>Nouvelle saison</h2>
          <SeasonForm action={createSeason.bind(null, ch.id)} suggested={suggested} defaultName={`${ch.name} National`} hasPrevious={seasons.length > 0} />
        </section>

        <section className="flex flex-col gap-4">
          <h2>Informations officielles</h2>
          <ChampionshipForm action={updateChampionship.bind(null, ch.id)} initial={ch} />
        </section>

        <section className="flex flex-col gap-4">
          <h2>Responsables</h2>
          <p className="text-sm text-muted-foreground">
            À renseigner selon l&apos;organisation officielle : un responsable peut être propre à ce championnat ou commun aux championnats nationaux. Un mandat clos reste dans
            l&apos;historique.
          </p>
          {active.length === 0 ? (
            <EmptyState icon="users" title="Aucun responsable en fonction" compact />
          ) : (
            <DataTable head={["Responsable", "Fonction", "Rattachement", "Depuis", "Contact", ""]}>
              {active.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">{o.fullName}</td>
                  <td>{o.position}</td>
                  <td className="text-sm">{o.championshipId ? ch.name : "Structure commune"}</td>
                  <td>{formatDate(new Date(o.startDate))}</td>
                  <td className="text-sm">{[o.email, o.phone].filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <EndMandateForm action={endMandate.bind(null, ch.code, o.id)} />
                      <RowActions name={o.fullName} onDelete={deleteOfficial.bind(null, ch.code, o.id)} />
                    </span>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <OfficialForm action={addOfficial.bind(null, ch.code)} championship={ch} />
          {ended.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Historique des mandats ({ended.length})</summary>
              <ul className="mt-2 flex flex-col divide-y">
                {ended.map((o) => (
                  <li key={o.id} className="py-2">
                    <strong>{o.fullName}</strong> — {o.position} · du {formatDate(new Date(o.startDate))} au {o.endDate ? formatDate(new Date(o.endDate)) : "—"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2>Documents officiels et règlements</h2>
          {documents.length === 0 ? (
            <EmptyState icon="document" title="Aucun document" compact>
              Règlement de la saison, calendrier officiel, décisions : publiés en PDF sur la page du championnat.
            </EmptyState>
          ) : (
            <DataTable head={["Document", "Saison", "Publié le", ""]}>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/media/championnats/documents/${d.id}`} target="_blank" rel="noreferrer">
                      {d.title}
                    </a>
                  </td>
                  <td>{d.season ? seasonLabel(d.season) : "Permanent"}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    <RowActions name={d.title} viewHref={`/media/championnats/documents/${d.id}`} onDelete={deleteDocument.bind(null, ch.code, d.id)} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <DocumentForm action={uploadDocument.bind(null, ch.id)} seasons={seasons.map((s) => s.c.season)} />
        </section>
      </div>
    </>
  );
}
