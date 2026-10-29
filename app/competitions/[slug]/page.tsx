import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { CompetitionFacts, loadSeason, SeasonView } from "@/components/competitions/season-view";
import { PublicShell } from "@/components/public/public-shell";
import { COMPETITION_CATEGORY_LABELS, COMPETITION_GENDER_LABELS, hasScore, publicStatusLabel } from "@/lib/competitions";
import { db } from "@/lib/db";
import { championships, competitions, leagues } from "@/lib/db/schema";
import { leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";

async function load(slug: string) {
  const [row] = await db
    .select({ c: competitions, league: leagues, championshipCode: championships.code })
    .from(competitions)
    .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
    .leftJoin(championships, eq(competitions.championshipId, championships.id))
    .where(and(eq(competitions.slug, slug), ne(competitions.status, "DRAFT")))
    .limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: PageProps<"/competitions/[slug]">): Promise<Metadata> {
  const row = await load((await params).slug);
  return row ? { title: `${row.c.name} — FECOFOOT`, description: `Calendrier, résultats et classement — ${row.c.name}, saison ${seasonLabel(row.c.season)}.` } : {};
}

/**
 * Compétition (coupe, championnat départemental, tournoi de jeunes ou féminin) : présentation,
 * règlement, clubs, calendrier, résultats, classement et buteurs (EF-PUB-03).
 * Une saison de championnat national s'affiche sur la page du championnat (zones, documents, responsables).
 */
export default async function PublicCompetitionPage({ params }: PageProps<"/competitions/[slug]">) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const { c, league, championshipCode } = row;
  if (championshipCode) redirect(`/championnats/${championshipCode}?saison=${c.season}`);
  const data = await loadSeason(c.id);
  const status = publicStatusLabel(c.status, data.matches.filter((m) => hasScore(m.match.status)).length);
  const organiser = league?.name ?? "Fédération Congolaise de Football";

  return (
    <PublicShell
      eyebrow="Compétitions"
      title={c.name}
      logo={league ? leagueLogoUrl(league) : null}
      subtitle={[organiser, `Saison ${seasonLabel(c.season)}`, COMPETITION_CATEGORY_LABELS[c.category], COMPETITION_GENDER_LABELS[c.gender], status].join(" · ")}
      wide
    >
      <div className="flex flex-col gap-10">
        <SeasonView c={c} data={data} />
        <section className="flex flex-col gap-3" aria-labelledby="reglement">
          <h2 id="reglement" className="text-lg font-bold">
            Présentation et règlement
          </h2>
          <p className="text-sm">
            Organisée par{" "}
            {league ? (
              <Link href={`/ligues/${league.code.toLowerCase()}`} className="font-semibold underline underline-offset-2">
                {league.name}
              </Link>
            ) : (
              <strong>la Fédération Congolaise de Football</strong>
            )}
            .
          </p>
          <CompetitionFacts c={c} pools={data.pools.length} />
        </section>
      </div>
    </PublicShell>
  );
}
