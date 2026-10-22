import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, ne } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, competitions, disciplineCases, players } from "@/lib/db/schema";
import { AUTO_REASON_LABELS, CASE_STATUS_LABELS, CASE_STATUSES, SANCTION_LABELS } from "@/lib/discipline";
import { textMatch } from "@/lib/text-search";
import { formatDate, formatDateTime } from "@/lib/format";
import { activeCaseSuspensions, competitionSuspensions } from "@/lib/queries/discipline";
import { openCase } from "./actions";
import { CaseForm } from "./DisciplineForms";

export const metadata: Metadata = { title: "Discipline — FECOFOOT" };

/** Commission de discipline : suspensions en cours, dossiers (M18). */
export default async function DisciplinePage({ searchParams }: PageProps<"/admin/discipline">) {
  await requirePermission("discipline.manage");
  const comps = await db.select({ id: competitions.id, name: competitions.name }).from(competitions).where(ne(competitions.status, "DRAFT")).orderBy(desc(competitions.season), asc(competitions.name));
  const sp = await searchParams;
  const raw = sp.competition;
  const compId = Number(Array.isArray(raw) ? raw[0] : raw) || comps[0]?.id;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const caseStatus = CASE_STATUSES.find((st) => st === sp.statut);
  const [auto, sanctions, cases, clubList] = await Promise.all([
    compId ? competitionSuspensions(compId) : Promise.resolve([]),
    activeCaseSuspensions(),
    db
      .select({ c: disciplineCases, lastName: players.lastName, firstName: players.firstName, club: clubs.name })
      .from(disciplineCases)
      .leftJoin(players, eq(disciplineCases.playerId, players.id))
      .leftJoin(clubs, eq(disciplineCases.clubId, clubs.id))
      .orderBy(desc(disciplineCases.createdAt))
      .limit(500),
    db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.name)),
  ]);
  const activeAuto = auto.filter((s) => s.active);
  const shownCases = cases.filter(
    ({ c, lastName, firstName, club }) => textMatch(q, c.number, lastName && `${lastName} ${firstName}`, club) && (!caseStatus || c.status === caseStatus),
  );

  return (
    <>
      <PageHeader eyebrow="Discipline" title="Commission de discipline" description="Suspensions automatiques (cumul de cartons), dossiers, décisions et publication." />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Suspensions en cours</h2>
          {comps.length > 0 && (
            <form className="flex items-end gap-2 text-sm">
              <SelectField label="Compétition" name="competition" defaultValue={compId}>
                {comps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <button type="submit" className="admin-btn admin-btn-outline">
                Afficher
              </button>
            </form>
          )}
          <DataTable head={["Joueur", "Club", "Motif", "Durée"]} pageSize={5}>
            {activeAuto.map((s) => (
              <tr key={`a-${s.playerId}-${s.fromMatchId}`}>
                <td className="px-3 py-2 font-medium">
                  {s.player?.firstName} {s.player?.lastName}
                </td>
                <td className="px-3 py-2">{s.player?.club}</td>
                <td className="px-3 py-2">{AUTO_REASON_LABELS[s.reason]} (automatique)</td>
                <td className="px-3 py-2">1 match</td>
              </tr>
            ))}
            {sanctions.map((s) => (
              <tr key={`c-${s.c.id}`}>
                <td className="px-3 py-2 font-medium">
                  {s.firstName} {s.lastName}
                </td>
                <td className="px-3 py-2">{s.club}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/discipline/${s.c.id}`} className="underline">
                    Décision {s.c.number}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {s.c.sanctionType === "MATCH_SUSPENSION" ? `${s.c.suspensionMatches! - s.played} match(s) restant(s)` : `jusqu'au ${formatDate(s.c.suspensionUntil)}`}
                </td>
              </tr>
            ))}
          </DataTable>
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Dossiers</h2>
          <form aria-label="Filtres" className="text-sm">
            {compId && <input type="hidden" name="competition" value={compId} />}
            <label>
              Recherche
              <input name="q" defaultValue={q} placeholder="N° de dossier, joueur, club" className="admin-input" style={{ maxWidth: 240 }} />
            </label>
            <SelectField label="Statut" name="statut" defaultValue={caseStatus ?? ""}>
              <option value="">Tous</option>
              {CASE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {CASE_STATUS_LABELS[st]}
                </option>
              ))}
            </SelectField>
            <button type="submit">Filtrer les dossiers</button>
          </form>
          <DataTable head={["N°", "Mis en cause", "Ouvert le", "Statut", ""]} pageSize={5}>
            {shownCases.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground">
                  Aucun dossier ne correspond.
                </td>
              </tr>
            )}
            {shownCases.map(({ c, lastName, firstName, club }) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/admin/discipline/${c.id}`} className="underline-offset-2 hover:underline">
                    {c.number}
                  </Link>
                </td>
                <td className="px-3 py-2">{[lastName && `${firstName} ${lastName}`, club].filter(Boolean).join(" · ")}</td>
                <td className="px-3 py-2">{formatDateTime(c.createdAt)}</td>
                <td className="px-3 py-2">
                  <StatusBadge tone={c.status === "DECIDED" ? "ok" : c.status === "OPEN" ? "wait" : "neutral"}>{CASE_STATUS_LABELS[c.status]}</StatusBadge>
                  {c.sanctionType && <span className="ml-2 text-xs text-muted-foreground">{SANCTION_LABELS[c.sanctionType]}</span>}
                </td>
                <td>
                  <RowActions name={`dossier ${c.number}`} viewHref={`/admin/discipline/${c.id}`} />
                </td>
              </tr>
            ))}
          </DataTable>
          <h3 className="mt-4 text-sm font-semibold">Ouvrir un dossier</h3>
          <CaseForm action={openCase} clubs={clubList} competitions={comps} />
        </section>
      </div>
    </>
  );
}
