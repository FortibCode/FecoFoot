import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { FixtureGroups } from "@/components/matches/fixture-groups";
import { GroupTable } from "@/components/matches/group-table";
import { MatchTabs } from "@/components/matches/match-tabs";
import { ArticleCard } from "@/components/public/article-card";
import { PublicShell } from "@/components/public/public-shell";
import { TeamBadge } from "@/components/public/team-badge";
import { db } from "@/lib/db";
import { articles, nationalTeams, nationalTeamVideos } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { photoUrl, teamCovers, teamPhotos } from "@/lib/photos";
import { PhotoPager } from "@/components/public/photo-pager";
import { fromNational, openTicketSales } from "@/lib/queries/matches";
import { calledPlayers, groupDetail, teamGroups, teamPage } from "@/lib/queries/national";
import { playerPhotoUrls } from "@/lib/queries/player-photos";

async function load(slug: string) {
  const [t] = await db.select().from(nationalTeams).where(eq(nationalTeams.slug, slug)).limit(1);
  return t ? teamPage(t.code, { publishedOnly: true }) : null;
}

export async function generateMetadata({ params }: PageProps<"/equipes-nationales/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  return data ? { title: `${data.team.name} — FECOFOOT`, description: `Présentation, effectif, calendrier, résultats, staff et photos — ${data.team.name}.` } : {};
}

const Muted = ({ children }: { children: ReactNode }) => <p className="bg-muted/60 p-4 text-sm text-muted-foreground">{children}</p>;

/**
 * Page d'une sélection nationale (EF-PUB-05, EF-SEL-03) : présentation, effectif (dernière liste publiée),
 * calendrier et résultats, compétitions, staff, actualités, photos et vidéos. Uniquement les informations
 * publiées par la fédération ; chaque rubrique explique ce qui n'est pas encore disponible.
 */
export default async function PublicNationalTeamPage({ params }: PageProps<"/equipes-nationales/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { team, staff, fixtures, selections } = data;
  const latest = selections[0];
  const upcoming = fixtures.filter((f) => f.status === "SCHEDULED").reverse();
  const [list, gallery, sales, covers, videos, news, groups] = await Promise.all([
    latest ? calledPlayers(latest.id) : Promise.resolve([]),
    teamPhotos(team.id),
    openTicketSales({ fixtureIds: upcoming.map((f) => f.id) }),
    teamCovers(),
    db.select().from(nationalTeamVideos).where(eq(nationalTeamVideos.teamId, team.id)).orderBy(desc(nationalTeamVideos.createdAt)),
    db
      .select()
      .from(articles)
      .where(and(eq(articles.nationalTeamId, team.id), eq(articles.status, "PUBLISHED")))
      .orderBy(desc(articles.publishedAt))
      .limit(6),
    teamGroups(team.id),
  ]);
  const [photos, groupTables] = await Promise.all([
    playerPhotoUrls(list.map((p) => p.playerId).filter((id): id is number => id !== null), { publicOnly: true }),
    Promise.all(groups.map((g) => groupDetail(g.group.id))),
  ]);
  const items = (rows: typeof fixtures) => rows.map((f) => fromNational({ f, team: team.name, teamSlug: team.slug }));
  const next = upcoming[0];
  const cover = covers[team.slug];
  const tagline = team.tagline ?? undefined;

  return (
    <PublicShell eyebrow="Équipes nationales" title={team.name} subtitle={tagline} wide hero={<div className="h-2" />}>
      <div className="flex flex-col gap-8">
        {/* Bandeau de la sélection : photo de la photothèque, sinon son repère en grand */}
        <section aria-label={team.name} className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden bg-brand-ink text-white sm:min-h-72">
          {cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias */}
              <img src={cover} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[50%_30%]" />
              <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.85),rgb(0_0_0/0.25)_60%,transparent)]" />
            </>
          ) : (
            <span aria-hidden className="absolute top-4 left-6 -z-10 font-display text-[8rem] leading-none font-bold text-white/10 sm:text-[11rem]">
              {team.shortLabel ?? ""}
            </span>
          )}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
          <div className="flex flex-col gap-2 p-6 sm:p-10">
            {tagline && <p className="text-xs font-semibold tracking-[0.16em] text-[var(--flag-yellow)] uppercase">{tagline}</p>}
            <h1 className="font-display text-4xl leading-none font-bold uppercase sm:text-6xl">{team.name}</h1>
            {next && (
              <Link href={`/matchs/selection/${next.id}`} className="mt-2 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/90 hover:text-white">
                Prochain match : {next.isHome ? `Congo – ${next.opponent}` : `${next.opponent} – Congo`}, {formatDate(next.kickoffAt)} <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </section>

        <MatchTabs
          label="Rubriques de la sélection"
          initial="presentation"
          tabs={[
            {
              id: "presentation",
              label: "Présentation",
              panel: (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  {team.description ? (
                    <p className="max-w-3xl leading-relaxed whitespace-pre-line">{team.description}</p>
                  ) : (
                    <Muted>La présentation de la sélection sera publiée par la fédération.</Muted>
                  )}
                  <dl className="flex flex-col gap-3 bg-muted/60 p-4 text-sm">
                    {(
                      [
                        ["Dernière liste", latest ? `${latest.title} (${formatDate(latest.publishedAt)})` : "Non publiée"],
                        ["Matchs au calendrier", String(fixtures.length)],
                        ["Staff technique", staff.length ? `${staff.length} membre${staff.length > 1 ? "s" : ""}` : "À communiquer"],
                        ["Photos", String(gallery.length)],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5">
                        <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ),
            },
            {
              id: "effectif",
              label: "Effectif",
              panel: latest ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{latest.title}</strong> · publiée le {formatDate(latest.publishedAt)}
                    {latest.gatheringDate && ` · regroupement le ${formatDate(latest.gatheringDate)}`}
                    {latest.location && ` · ${latest.location}`}
                  </p>
                  {latest.purpose && <p className="max-w-3xl text-sm leading-relaxed">{latest.purpose}</p>}
                  {list.length === 0 ? (
                    <Muted>La liste des joueurs convoqués sera publiée par la fédération.</Muted>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 bg-muted/60 p-3 text-sm">
                          {/* Photo seulement si le joueur en a autorisé la publication (ou portrait sous licence libre) ; sinon son numéro. */}
                          {(p.playerId && photos.get(p.playerId)) || p.portrait ? (
                            // eslint-disable-next-line @next/next/no-img-element -- photo servie par la route des médias
                            <img src={(p.playerId && photos.get(p.playerId)) || p.portrait!} alt="" className="size-11 shrink-0 rounded-full object-cover object-top" />
                          ) : (
                            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-ink font-display text-base font-bold text-white tabular-nums">
                              {p.shirtNumber ?? "–"}
                            </span>
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold">{p.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[p.position ? POSITION_LABELS[p.position] : null, p.club].filter(Boolean).join(" · ")}
                            </span>
                            {p.portrait && p.portraitCredit && <span className="truncate text-[0.65rem] text-muted-foreground/80">Photo : {p.portraitCredit}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Muted>Aucune liste de convoqués publiée pour cette sélection.</Muted>
              ),
            },
            {
              id: "calendrier",
              label: "Calendrier et résultats",
              panel:
                fixtures.length === 0 ? (
                  <Muted>Le calendrier de la sélection sera publié par la fédération.</Muted>
                ) : (
                  <div className="flex flex-col gap-6">
                    {sales.length > 0 && (
                      <ul className="flex flex-col gap-2">
                        {sales.map((t) => {
                          const f = fixtures.find((x) => x.id === t.fixtureId);
                          return f ? (
                            <li key={t.slug} className="flex flex-wrap items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--flag-yellow)_18%,transparent)] p-3 text-sm">
                              <span>
                                <strong>Billetterie ouverte</strong> · {f.isHome ? `Congo – ${f.opponent}` : `${f.opponent} – Congo`}
                              </span>
                              <Link href={`/billetterie/${t.slug}`} className="inline-flex h-9 items-center gap-1.5 bg-[var(--flag-yellow)] px-3 text-xs font-semibold text-brand-ink hover:brightness-95">
                                Acheter un billet <span aria-hidden>→</span>
                              </Link>
                            </li>
                          ) : null;
                        })}
                      </ul>
                    )}
                    {upcoming.length > 0 && (
                      <section aria-label="Prochains matchs" className="flex flex-col gap-3">
                        <h2 className="font-heading text-lg font-bold uppercase">Prochains matchs</h2>
                        <FixtureGroups items={items(upcoming)} showDate />
                      </section>
                    )}
                    {fixtures.some((f) => f.status !== "SCHEDULED") && (
                      <section aria-label="Résultats" className="flex flex-col gap-3">
                        <h2 className="font-heading text-lg font-bold uppercase">Résultats</h2>
                        <FixtureGroups items={items(fixtures.filter((f) => f.status !== "SCHEDULED"))} showDate />
                      </section>
                    )}
                  </div>
                ),
            },
            {
              id: "competitions",
              label: "Compétitions",
              panel:
                groupTables.length > 0 ? (
                  <div className="flex flex-col gap-8">
                    {groupTables.map((g) =>
                      g ? (
                        <section key={g.group.id} aria-label={`${g.competition.name} · ${g.group.name}`} className="flex flex-col gap-3">
                          <h2 className="font-heading text-lg font-bold uppercase">
                            {g.competition.name} · {g.group.name}
                          </h2>
                          <GroupTable rows={g.tables.all} qualifiers={g.group.qualifiers} />
                        </section>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <Muted>
                    {fixtures.some((f) => f.competition)
                      ? `Compétitions au calendrier : ${[...new Set(fixtures.map((f) => f.competition).filter(Boolean))].join(" ; ")}.`
                      : "Aucune compétition enregistrée pour cette sélection."}
                  </Muted>
                ),
            },
            {
              id: "staff",
              label: "Staff",
              panel:
                staff.length === 0 ? (
                  <Muted>Le staff technique sera communiqué par la fédération.</Muted>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {staff.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 bg-muted/60 p-3 text-sm">
                        <TeamBadge name={s.fullName} size="sm" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{s.fullName}</span>
                          <span className="truncate text-xs text-muted-foreground">{s.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              id: "actualites",
              label: "Actualités",
              panel:
                news.length === 0 ? (
                  <Muted>Aucune actualité publiée pour cette sélection.</Muted>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {news.map((a) => (
                      <li key={a.id}>
                        <ArticleCard a={a} />
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              id: "photos",
              label: "Photos et vidéos",
              panel: (
                <div className="flex flex-col gap-8">
                  {gallery.length === 0 ? (
                    <Muted>Aucune photo publiée pour cette sélection.</Muted>
                  ) : (
                    // Portraits de même format, 5 par page ; légende au survol.
                    <PhotoPager photos={gallery.map((p) => ({ id: p.id, src: photoUrl(p), caption: p.caption, credit: p.credit, width: p.width, height: p.height }))} />
                  )}
                  {videos.length > 0 && (
                    <section aria-label="Vidéos" className="flex flex-col gap-3">
                      <h2 className="font-heading text-lg font-bold uppercase">Vidéos</h2>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {videos.map((v) => (
                          <li key={v.id}>
                            <a href={v.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 bg-muted/60 p-3 text-sm hover:bg-muted">
                              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--flag-red)] text-white">
                                ▶
                              </span>
                              <span className="font-semibold group-hover:underline">{v.title}</span>
                              <span className="sr-only"> (nouvel onglet)</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </PublicShell>
  );
}
