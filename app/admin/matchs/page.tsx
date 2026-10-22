import type { Metadata } from "next";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { StatCards } from "@/components/admin/stat-cards";
import { MatchLine } from "@/components/competitions/match-line";
import { SelectField } from "@/components/ui/field";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { MATCH_STATUS_LABELS, MATCH_STATUSES, type MatchStatus } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, matches, matchOfficials } from "@/lib/db/schema";
import { awayClub, homeClub, matchQuery, refereeOf } from "@/lib/queries/competitions";

export const metadata: Metadata = { title: "Matchs — FECOFOOT" };

const PAGE_SIZE = 5;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const STATES = { "a-venir": "À venir", passes: "Passés", "en-direct": "En direct", "a-valider": "Résultats à valider", "sans-arbitre": "Sans arbitre désigné" } as const;
type State = keyof typeof STATES;

/**
 * Matchs selon le profil : tous (fédération, arbitrage), ceux des compétitions de sa ligue, ceux de son club,
 * ou ceux où l'on est désigné. Recherche par club, filtres par compétition, statut et situation.
 */
export default async function MatchesPage({ searchParams }: PageProps<"/admin/matchs">) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: SQL[] = [];

  if (can(user.role, "lineups.submit")) {
    scope.push(or(eq(matches.homeClubId, user.clubId ?? -1), eq(matches.awayClubId, user.clubId ?? -1))!);
  } else if (can(user.role, "referee.self")) {
    const ref = await refereeOf(user);
    const mine = ref ? (await db.select({ id: matchOfficials.matchId }).from(matchOfficials).where(eq(matchOfficials.refereeId, ref.id))).map((r) => r.id) : [];
    scope.push(inArray(matches.id, mine.length ? mine : [-1]));
  } else if (user.role === "LEAGUE") {
    // Une ligue suit les matchs des compétitions qu'elle organise.
    scope.push(eq(competitions.leagueId, user.leagueId ?? -1));
  } else if (!can(user.role, "competitions.manage") && !can(user.role, "refereeing.manage")) {
    redirect("/admin/acces-refuse");
  }

  const q = one(sp.q);
  const competitionId = Number(one(sp.competition)) || undefined;
  const status = MATCH_STATUSES.find((s) => s === one(sp.status)) as MatchStatus | undefined;
  const state = (Object.keys(STATES) as State[]).find((s) => s === one(sp.etat)) ?? (q || competitionId || status ? undefined : "a-venir");
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const filters: SQL[] = [...scope];
  if (q) filters.push(or(ilike(homeClub.name, `%${q}%`), ilike(awayClub.name, `%${q}%`), ilike(matches.venue, `%${q}%`))!);
  if (competitionId) filters.push(eq(matches.competitionId, competitionId));
  if (status) filters.push(eq(matches.status, status));
  if (state === "a-venir") filters.push(or(isNull(matches.kickoffAt), gte(matches.kickoffAt, sql`now() - interval '3 hours'`))!, inArray(matches.status, ["SCHEDULED", "POSTPONED", "LIVE", "HALF_TIME"]));
  if (state === "passes") filters.push(lt(matches.kickoffAt, sql`now()`));
  if (state === "en-direct") filters.push(inArray(matches.status, ["LIVE", "HALF_TIME"]));
  if (state === "a-valider") filters.push(eq(matches.status, "FINISHED"), isNull(matches.validatedAt));
  if (state === "sans-arbitre") {
    filters.push(
      eq(matches.status, "SCHEDULED"),
      gte(matches.kickoffAt, sql`now()`),
      sql`not exists (select 1 from ${matchOfficials} where ${matchOfficials.matchId} = ${matches.id} and ${matchOfficials.role} = 'REFEREE')`,
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const upcoming = state === "a-venir" || state === "sans-arbitre";

  const [rows, [{ total }], comps, [counts]] = await Promise.all([
    matchQuery()
      .where(where)
      .orderBy(upcoming ? asc(matches.kickoffAt) : desc(matches.kickoffAt), asc(matches.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(matches)
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .leftJoin(homeClub, eq(matches.homeClubId, homeClub.id))
      .leftJoin(awayClub, eq(matches.awayClubId, awayClub.id))
      .where(where),
    db
      .select({ id: competitions.id, name: competitions.name })
      .from(competitions)
      .where(user.role === "LEAGUE" ? eq(competitions.leagueId, user.leagueId ?? -1) : undefined)
      .orderBy(desc(competitions.season), asc(competitions.name)),
    db
      .select({
        live: sql<number>`count(*) filter (where ${matches.status} in ('LIVE', 'HALF_TIME'))::int`,
        toValidate: sql<number>`count(*) filter (where ${matches.status} = 'FINISHED' and ${matches.validatedAt} is null)::int`,
        week: sql<number>`count(*) filter (where ${matches.kickoffAt} between now() and now() + interval '7 days')::int`,
        unscheduled: sql<number>`count(*) filter (where ${matches.kickoffAt} is null and ${matches.status} = 'SCHEDULED')::int`,
      })
      .from(matches)
      .innerJoin(competitions, eq(matches.competitionId, competitions.id))
      .where(scope.length ? and(...scope) : undefined),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) =>
    `/admin/matchs?${new URLSearchParams({
      ...(q && { q }),
      ...(competitionId && { competition: String(competitionId) }),
      ...(status && { status }),
      ...(state && { etat: state }),
      page: String(p),
    })}`;

  return (
    <>
      <PageHeader eyebrow="Sport" title="Matchs" description="Programmation, feuilles de match, résultats et désignations." />
      <StatCards
        stats={[
          { label: "En direct", value: counts.live, href: "/admin/matchs?etat=en-direct", active: state === "en-direct" },
          { label: "Cette semaine", value: counts.week, sub: "7 prochains jours" },
          { label: "Résultats à valider", value: counts.toValidate, href: "/admin/matchs?etat=a-valider", active: state === "a-valider" },
          { label: "Sans date", value: counts.unscheduled, sub: "à programmer" },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Club ou stade" className="admin-input" style={{ maxWidth: 220 }} />
        </label>
        <SelectField label="Compétition" name="competition" defaultValue={competitionId ?? ""}>
          <option value="">Toutes</option>
          {comps.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Statut" name="status" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          {MATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {MATCH_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Situation" name="etat" defaultValue={state ?? ""}>
          <option value="">Toutes</option>
          {(Object.keys(STATES) as State[]).map((k) => (
            <option key={k} value={k}>
              {STATES[k]}
            </option>
          ))}
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon="calendar" title="Aucun match ne correspond">
          Modifiez les filtres, ou générez le calendrier d’une compétition pour créer les rencontres.
        </EmptyState>
      ) : (
        <>
          <div className="admin-table-wrap divide-y" data-testid="match-list">
            {rows.map((r) => (
              <div key={r.match.id}>
                <p className="px-3 pt-2 text-xs text-muted-foreground">
                  {r.competition.name}
                  {r.match.status === "FINISHED" && !r.match.validatedAt && " · résultat à valider"}
                </p>
                <MatchLine row={r} href={`/admin/matchs/${r.match.id}`} />
              </div>
            ))}
          </div>
          <Pager page={page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={href} />
        </>
      )}
    </>
  );
}
