import type { Metadata } from "next";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { clubs, competitions, disciplineCases, players } from "@/lib/db/schema";
import { SANCTION_LABELS } from "@/lib/discipline";
import { formatDate, formatFcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Décisions disciplinaires — FECOFOOT", description: "Décisions de la commission de discipline de la FECOFOOT." };

/** Publication des décisions de la commission (EF-DIS-01). */
export default async function PublicDisciplinePage() {
  await connection();
  const rows = await db
    .select({ c: disciplineCases, lastName: players.lastName, firstName: players.firstName, club: clubs.name, competition: competitions.name })
    .from(disciplineCases)
    .leftJoin(players, eq(disciplineCases.playerId, players.id))
    .leftJoin(clubs, eq(disciplineCases.clubId, clubs.id))
    .leftJoin(competitions, eq(disciplineCases.competitionId, competitions.id))
    .where(and(eq(disciplineCases.status, "DECIDED"), isNotNull(disciplineCases.publishedAt)))
    .orderBy(desc(disciplineCases.decidedAt))
    .limit(100);
  return (
    <PublicShell eyebrow="Commission de discipline" title="Décisions" wide>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Aucune décision publiée.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ c, lastName, firstName, club, competition }) => (
            <li key={c.id} className="rounded-lg border p-4 text-sm">
              <p className="text-xs text-muted-foreground">
                {c.number} · décision du {formatDate(c.decidedAt)}
                {competition && ` · ${competition}`}
              </p>
              <p className="font-semibold">{[lastName && `${firstName} ${lastName}`, club].filter(Boolean).join(" — ")}</p>
              <p>
                {c.sanctionType && SANCTION_LABELS[c.sanctionType]}
                {c.sanctionType === "MATCH_SUSPENSION" && ` : ${c.suspensionMatches} match(s)`}
                {c.sanctionType === "TIME_SUSPENSION" && ` jusqu'au ${formatDate(c.suspensionUntil)}`}
                {c.sanctionType === "FINE" && ` : ${formatFcfa(c.fineAmount ?? 0)}`}
                {c.sanctionType === "POINTS_DEDUCTION" && ` : ${c.pointsDeducted} point(s)`}
              </p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{c.decision}</p>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
