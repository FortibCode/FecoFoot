import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, competitions, disciplineCases, players } from "@/lib/db/schema";
import { CASE_STATUS_LABELS, SANCTION_LABELS } from "@/lib/discipline";
import { formatDate, formatDateTime, formatFcfa } from "@/lib/format";
import { decideCase, dismissCase, setCasePublished } from "../actions";
import { DecisionForm } from "../DisciplineForms";

export const metadata: Metadata = { title: "Dossier disciplinaire — FECOFOOT" };

export default async function CasePage({ params }: PageProps<"/admin/discipline/[id]">) {
  await requirePermission("discipline.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db
    .select({ c: disciplineCases, lastName: players.lastName, firstName: players.firstName, federalId: players.federalId, club: clubs.name, competition: competitions.name })
    .from(disciplineCases)
    .leftJoin(players, eq(disciplineCases.playerId, players.id))
    .leftJoin(clubs, eq(disciplineCases.clubId, clubs.id))
    .leftJoin(competitions, eq(disciplineCases.competitionId, competitions.id))
    .where(eq(disciplineCases.id, id))
    .limit(1);
  if (!row) notFound();
  const { c } = row;
  const sanction =
    c.sanctionType &&
    `${SANCTION_LABELS[c.sanctionType]}${
      c.sanctionType === "MATCH_SUSPENSION" ? ` : ${c.suspensionMatches} match(s)` : c.sanctionType === "TIME_SUSPENSION" ? ` jusqu'au ${formatDate(c.suspensionUntil)}` : c.sanctionType === "FINE" ? ` : ${formatFcfa(c.fineAmount ?? 0)}` : c.sanctionType === "POINTS_DEDUCTION" ? ` : ${c.pointsDeducted} point(s)` : ""
    }`;

  return (
    <>
      <PageHeader eyebrow={`Discipline · ${CASE_STATUS_LABELS[c.status]}`} title={c.number} description={`Ouvert le ${formatDateTime(c.createdAt)}${c.hearingAt ? ` · audience le ${formatDateTime(c.hearingAt)}` : ""}`} />
      <div className="flex flex-col gap-8">
        <dl className="grid max-w-3xl gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Joueur</dt><dd>{row.lastName ? `${row.firstName} ${row.lastName} (${row.federalId})` : "—"}</dd></div>
          <div><dt className="text-muted-foreground">Club</dt><dd>{row.club ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Compétition</dt><dd>{row.competition ?? "Toutes"}</dd></div>
          <div><dt className="text-muted-foreground">Sanction</dt><dd data-testid="sanction">{sanction ?? "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Faits</dt><dd className="whitespace-pre-line">{c.facts}</dd></div>
          {c.decision && <div className="sm:col-span-2"><dt className="text-muted-foreground">Décision</dt><dd className="whitespace-pre-line">{c.decision}</dd></div>}
        </dl>

        {c.status === "OPEN" && (
          <>
            <section className="flex flex-col gap-3 border-t pt-6">
              <h2 className="font-semibold">Décision de la commission</h2>
              <DecisionForm action={decideCase.bind(null, id)} />
            </section>
            <ActionForm action={dismissCase.bind(null, id)} label="Classer sans suite" field={{ name: "reason", label: "Motif", required: true }} />
          </>
        )}
        {c.status === "DECIDED" && (
          <section className="flex flex-col gap-2 border-t pt-6">
            <p className="text-sm">{c.publishedAt ? `Publiée sur le portail le ${formatDateTime(c.publishedAt)}.` : "Non publiée."}</p>
            <ActionForm action={setCasePublished.bind(null, id, !c.publishedAt)} label={c.publishedAt ? "Retirer du portail" : "Publier la décision"} variant={c.publishedAt ? "outline" : "default"} />
          </section>
        )}
      </div>
    </>
  );
}
