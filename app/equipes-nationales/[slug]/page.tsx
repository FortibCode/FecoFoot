import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";
import { formatDate, formatDateTime } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { calledPlayers, teamPage } from "@/lib/queries/national";

async function load(slug: string) {
  const [t] = await db.select().from(nationalTeams).where(eq(nationalTeams.slug, slug)).limit(1);
  return t ? teamPage(t.code, { publishedOnly: true }) : null;
}

export async function generateMetadata({ params }: PageProps<"/equipes-nationales/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: `${data.team.name} — FECOFOOT`, description: `Staff, liste des convoqués, calendrier et résultats — ${data.team.name}.` } : {};
}

/** Staff, dernière liste de convoqués publiée, calendrier et résultats (EF-PUB-05, EF-SEL-03). */
export default async function PublicNationalTeamPage({ params }: PageProps<"/equipes-nationales/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { team, staff, fixtures, selections } = data;
  const latest = selections[0];
  const list = latest ? await calledPlayers(latest.id) : [];

  return (
    <PublicShell eyebrow="Équipes nationales" title={team.name} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{latest ? latest.title : "Liste des convoqués"}</h2>
          {latest ? (
            <>
              <p className="text-sm text-muted-foreground">
                Publiée le {formatDate(latest.publishedAt)}
                {latest.gatheringDate && ` · regroupement le ${formatDate(latest.gatheringDate)}`}
                {latest.location && ` · ${latest.location}`}
              </p>
              <ul className="flex flex-col divide-y rounded-lg border text-sm">
                {list.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 px-3 py-2">
                    <span>
                      <span className="inline-block w-8 font-bold tabular-nums">{p.shirtNumber ?? ""}</span>
                      <strong>{p.name}</strong> <span className="text-muted-foreground">{p.position ? POSITION_LABELS[p.position] : ""}</span>
                    </span>
                    <span className="text-right text-muted-foreground">{p.club}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune liste publiée.</p>
          )}
        </section>
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Staff</h2>
            <ul className="text-sm">
              {staff.map((s) => (
                <li key={s.id}>
                  <strong>{s.fullName}</strong> — {s.role}
                </li>
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Calendrier et résultats</h2>
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {fixtures.map((f) => (
                <li key={f.id} className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(f.kickoffAt)}
                    {f.competition && ` · ${f.competition}`}
                  </p>
                  <p className="font-medium">
                    {f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`}
                    {f.status === "PLAYED" && (
                      <strong className="ml-2">{f.isHome ? `${f.goalsFor} – ${f.goalsAgainst}` : `${f.goalsAgainst} – ${f.goalsFor}`}</strong>
                    )}
                    {f.status === "CANCELLED" && <span className="ml-2 text-destructive">annulé</span>}
                  </p>
                </li>
              ))}
              {fixtures.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun match programmé.</li>}
            </ul>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
