import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { openTicketSales } from "@/lib/queries/matches";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";
import { formatDate, formatMatchDate } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { calledPlayers, teamPage } from "@/lib/queries/national";
import { photoUrl, teamPhotos } from "@/lib/photos";

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
  // Prochains matchs d'abord (du plus proche au plus lointain), puis les résultats (du plus récent au plus ancien).
  const upcoming = fixtures.filter((f) => f.status === "SCHEDULED").reverse();
  const ordered = [...upcoming, ...fixtures.filter((f) => f.status !== "SCHEDULED")];
  const [list, gallery, sales] = await Promise.all([latest ? calledPlayers(latest.id) : [], teamPhotos(team.id), openTicketSales({ fixtureIds: upcoming.map((f) => f.id) })]);
  // Billetterie ouverte d'un match à venir : bouton « Acheter un billet ».
  const ticketOf = new Map(sales.map((t) => [t.fixtureId, t]));

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
              {latest.purpose && <p className="max-w-3xl text-sm leading-relaxed">{latest.purpose}</p>}
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">La liste des joueurs convoqués sera publiée par la fédération.</p>
              ) : (
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
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune liste publiée.</p>
          )}
        </section>
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Staff</h2>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">Staff technique à communiquer par la fédération.</p>
            ) : (
              <ul className="text-sm">
                {staff.map((s) => (
                  <li key={s.id}>
                    <strong>{s.fullName}</strong> — {s.role}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">Calendrier et résultats</h2>
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {ordered.map((f) => (
                <li key={f.id} className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {formatMatchDate(f.kickoffAt)}
                    {f.competition && ` · ${f.competition}`}
                  </p>
                  <p className="font-medium">
                    <Link href={`/matchs/selection/${f.id}`} className="underline-offset-2 hover:underline">
                      {f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`}
                    </Link>
                    {f.status === "PLAYED" && (
                      <strong className="ml-2">{f.isHome ? `${f.goalsFor} – ${f.goalsAgainst}` : `${f.goalsAgainst} – ${f.goalsFor}`}</strong>
                    )}
                    {f.status === "CANCELLED" && <span className="ml-2 text-destructive">annulé</span>}
                  </p>
                  {f.venue && <p className="text-xs text-muted-foreground">{f.venue}</p>}
                  {ticketOf.get(f.id) && (
                    <Link
                      href={`/billetterie/${ticketOf.get(f.id)!.slug}`}
                      className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--flag-yellow)] px-3 text-xs font-semibold text-brand-ink hover:brightness-95"
                    >
                      Acheter un billet <span aria-hidden>→</span>
                    </Link>
                  )}
                </li>
              ))}
              {fixtures.length === 0 && <li className="px-3 py-2 text-muted-foreground">Aucun match programmé.</li>}
            </ul>
          </section>
        </div>
      </div>

      {gallery.length > 0 && (
        <section id="photos" aria-labelledby="photos-title" className="mt-12 flex scroll-mt-6 flex-col gap-4">
          <h2 id="photos-title" className="text-2xl font-bold uppercase">
            En images <span className="text-base font-normal normal-case text-muted-foreground">· {gallery.length} photo(s)</span>
          </h2>
          {/* Mosaïque : chaque photo garde ses proportions (portrait ou paysage). */}
          <ul className="columns-2 gap-3 sm:columns-3 [&>li]:mb-3">
            {gallery.map((p) => (
              <li key={p.id} className="break-inside-avoid">
                <figure className="overflow-hidden rounded-xl border bg-card">
                  <a href={photoUrl(p)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
                    <img src={photoUrl(p)} alt={p.caption} width={p.width} height={p.height} loading="lazy" className="h-auto w-full" />
                  </a>
                  {p.caption && <figcaption className="px-3 py-2 text-xs text-muted-foreground">{p.caption} · © {p.credit}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PublicShell>
  );
}
