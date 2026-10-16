import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { nationalTeams, selections } from "@/lib/db/schema";
import { formatDate, formatDateTime } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { SELECTION_STATUS_LABELS } from "@/lib/national-teams";
import { calledPlayers } from "@/lib/queries/national";
import { addCalledPlayer, removeCalledPlayer, setSelectionPublished } from "../../actions";
import { CallUpForm } from "../../SelectionForms";

export const metadata: Metadata = { title: "Liste de convoqués — FECOFOOT" };

export default async function SelectionPage({ params }: PageProps<"/admin/selections/convocation/[id]">) {
  await requirePermission("national_teams.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [row] = await db
    .select({ s: selections, team: nationalTeams })
    .from(selections)
    .innerJoin(nationalTeams, eq(selections.teamId, nationalTeams.id))
    .where(eq(selections.id, id))
    .limit(1);
  if (!row) notFound();
  const { s, team } = row;
  const list = await calledPlayers(id);
  const published = s.status === "PUBLISHED";

  return (
    <>
      <PageHeader
        eyebrow={team.name}
        title={s.title}
        description={[s.gatheringDate && `Regroupement le ${formatDate(s.gatheringDate)}`, s.location, `${list.length} joueur(s)`].filter(Boolean).join(" · ")}
        actions={
          <>
            <a href={`/admin/exports/convocation/${id}?format=pdf`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Liste PDF
            </a>
            <a href={`/admin/exports/convocation/${id}?format=xlsx`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Excel
            </a>
            <a href={`/admin/exports/convocation/${id}/lettres`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Lettres aux clubs (PDF)
            </a>
          </>
        }
      />
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={published ? "ok" : "neutral"}>{SELECTION_STATUS_LABELS[s.status]}</StatusBadge>
          {published && <span className="text-sm text-muted-foreground">publiée le {formatDateTime(s.publishedAt)}</span>}
          <ActionForm
            action={setSelectionPublished.bind(null, id, !published)}
            label={published ? "Retirer du portail" : "Publier sur le portail"}
            variant={published ? "outline" : "default"}
          />
        </div>
        {s.purpose && <p className="whitespace-pre-line text-sm">{s.purpose}</p>}

        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {list.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                <span className="inline-block w-8 font-bold tabular-nums">{p.shirtNumber ?? ""}</span>
                <strong>{p.name}</strong>
                <span className="ml-2 text-muted-foreground">
                  {p.position ? POSITION_LABELS[p.position] : ""} · {p.club}
                </span>
                {p.abroad && <span className="ml-2 rounded bg-muted px-1 text-xs">étranger</span>}
              </span>
              <form action={removeCalledPlayer.bind(null, id, p.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  Retirer
                </Button>
              </form>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun joueur convoqué.</li>}
        </ul>
        <CallUpForm action={addCalledPlayer.bind(null, id)} />
        <Link href={`/admin/selections/${team.code}`} className="text-sm underline">
          Retour à la sélection
        </Link>
      </div>
    </>
  );
}
