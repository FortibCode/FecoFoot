import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { formatDate, formatDateTime } from "@/lib/format";
import { SELECTION_STATUS_LABELS } from "@/lib/national-teams";
import { teamPage } from "@/lib/queries/national";
import { addFixture, addStaff, createSelection, removeStaff, setFixtureResult } from "../actions";
import { FixtureForm, FixtureResultForm, SelectionCreateForm, StaffForm } from "../SelectionForms";

export const metadata: Metadata = { title: "Sélection nationale — FECOFOOT" };

export default async function NationalTeamPage({ params }: PageProps<"/admin/selections/[code]">) {
  await requirePermission("national_teams.manage");
  const { code } = await params;
  const data = await teamPage(code, { publishedOnly: false });
  if (!data) notFound();
  const { team, staff, fixtures, selections } = data;

  return (
    <>
      <PageHeader
        eyebrow="Équipes nationales"
        title={team.name}
        actions={
          <Link href={`/equipes-nationales/${team.slug}`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
            Page publique
          </Link>
        }
      />
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Listes de convoqués</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {selections.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <Link href={`/admin/selections/convocation/${s.id}`} className="font-medium underline-offset-2 hover:underline">
                  {s.title}
                </Link>
                <StatusBadge tone={s.status === "PUBLISHED" ? "ok" : "neutral"}>{SELECTION_STATUS_LABELS[s.status]}</StatusBadge>
              </li>
            ))}
            {selections.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucune liste.</li>}
          </ul>
          <SelectionCreateForm action={createSelection.bind(null, team.code)} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Staff technique</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-3 py-2">
                <span>
                  <strong>{s.fullName}</strong> — {s.role}
                </span>
                <form action={removeStaff.bind(null, team.code, s.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Retirer
                  </Button>
                </form>
              </li>
            ))}
            {staff.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun membre.</li>}
          </ul>
          <StaffForm action={addStaff.bind(null, team.code)} />
        </section>

        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="font-semibold">Calendrier et résultats</h2>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {fixtures.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="text-muted-foreground">{formatDateTime(f.kickoffAt)}</span> ·{" "}
                  <strong>{f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`}</strong>
                  {f.competition && <span className="text-muted-foreground"> · {f.competition}</span>}
                </span>
                <FixtureResultForm action={setFixtureResult.bind(null, team.code, f.id)} current={f} />
              </li>
            ))}
            {fixtures.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun match.</li>}
          </ul>
          <FixtureForm action={addFixture.bind(null, team.code)} />
        </section>
        <p className="text-xs text-muted-foreground">Dernière mise à jour : {formatDate(new Date())}</p>
      </div>
    </>
  );
}
