import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionFacts, Empty, loadSeason, SeasonView } from "@/components/competitions/season-view";
import { PublicShell } from "@/components/public/public-shell";
import { COMPETITION_CATEGORY_LABELS, hasScore, publicStatusLabel } from "@/lib/competitions";
import { formatDate } from "@/lib/format";
import { championshipLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { championshipByCode, championshipDocumentsOf, championshipOfficialsOf, championshipSeason } from "@/lib/queries/championships";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export async function generateMetadata({ params }: PageProps<"/championnats/[code]">): Promise<Metadata> {
  const ch = await championshipByCode((await params).code);
  return ch?.active ? { title: `${ch.name} — FECOFOOT`, description: `${ch.name} : clubs, calendrier, résultats, classement et statistiques.` } : {};
}

/** Championnat national (Ligue 1, Ligue 2) : saison choisie, zones ou groupes, calendrier, résultats, classement. */
export default async function PublicChampionshipPage({ params, searchParams }: PageProps<"/championnats/[code]">) {
  const ch = await championshipByCode((await params).code);
  if (!ch?.active) notFound();
  const sp = await searchParams;
  // Une saison en préparation est visible (clubs engagés connus) ; son statut est affiché sous le titre.
  const { editions, current } = await championshipSeason(ch.id, Number(one(sp.saison)) || undefined);
  const [officials, documents] = await Promise.all([championshipOfficialsOf(ch.id), championshipDocumentsOf(ch.id, { published: true })]);
  const active = officials.filter((o) => o.status === "ACTIVE");

  const data = current ? await loadSeason(current.id) : null;
  const pools = data?.pools ?? [];
  const zone = pools.find((p) => p === one(sp.zone)?.toUpperCase());
  const query = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ saison: current ? String(current.season) : undefined, zone, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return `/championnats/${ch.code}${s ? `?${s}` : ""}`;
  };
  const chip = (activeChip: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activeChip ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:bg-muted"}`;

  return (
    <PublicShell
      eyebrow="Compétitions nationales"
      title={ch.name}
      logo={championshipLogoUrl(ch)}
      subtitle={current ? `Saison ${seasonLabel(current.season)} · ${COMPETITION_CATEGORY_LABELS[current.category]} · ${publicStatusLabel(current.status, data ? data.matches.filter((m) => hasScore(m.match.status)).length : 0)}` : "Championnat national"}
      wide
    >
      <div className="flex flex-col gap-10">
        {/* Saisons (historique) et zones / groupes de la saison */}
        <nav aria-label="Saisons et zones" className="flex flex-col gap-3">
          {editions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saison</span>
              {editions.map((e) => (
                <Link key={e.id} href={`/championnats/${ch.code}?saison=${e.season}`} className={chip(e.id === current?.id)} aria-current={e.id === current?.id ? "page" : undefined}>
                  {seasonLabel(e.season)}
                </Link>
              ))}
            </div>
          )}
          {pools.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone</span>
              <Link href={query({ zone: undefined })} className={chip(!zone)}>
                Toutes
              </Link>
              {pools.map((p) => (
                <Link key={p} href={query({ zone: p })} className={chip(zone === p)} aria-current={zone === p ? "page" : undefined}>
                  Zone {p}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {!current || !data ? (
          <Empty>Aucune saison n&apos;est encore ouverte pour ce championnat. Le calendrier et les clubs participants apparaîtront ici dès leur publication.</Empty>
        ) : (
          <SeasonView c={current} data={data} pool={zone} poolLabel="Zone" />
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Informations officielles</h2>
            {ch.description ? <p className="whitespace-pre-line text-sm leading-relaxed">{ch.description}</p> : <Empty>Informations à venir.</Empty>}
            {current && <CompetitionFacts c={current} pools={pools.length} poolLabel="zone" />}
            {active.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {active.map((o) => (
                  <li key={o.id}>
                    <strong>{o.fullName}</strong> — {o.position} <span className="text-muted-foreground">(depuis le {formatDate(new Date(o.startDate))})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Documents et règlements</h2>
            {documents.length === 0 ? (
              <Empty>Aucun document publié.</Empty>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg bg-muted/60 text-sm">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <a href={`/media/championnats/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                      {d.title}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">{d.season ? seasonLabel(d.season) : "Permanent"} · PDF</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
