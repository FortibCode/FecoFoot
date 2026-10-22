import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requirePermission } from "@/lib/auth/guard";
import {
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  COMPETITION_STATUS_LABELS,
  COMPETITION_STATUSES,
  COMPETITION_TYPE_LABELS,
  type CompetitionCategory,
  type CompetitionStatus,
} from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions, competitionTeams, leagues } from "@/lib/db/schema";
import { seasonLabel } from "@/lib/licenses";
import { leagueOptions } from "@/lib/queries/reference";
import { deleteCompetition } from "./actions";

export const metadata: Metadata = { title: "Compétitions — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Compétitions nationales et départementales ; un compte de ligue ne voit que celles de sa ligue. */
export default async function CompetitionsPage({ searchParams }: PageProps<"/admin/competitions">) {
  const user = await requirePermission("competitions.manage");
  const sp = await searchParams;
  const q = one(sp.q);
  const season = Number(one(sp.season)) || undefined;
  const organiser = one(sp.organiser);
  const status = COMPETITION_STATUSES.find((s) => s === one(sp.status)) as CompetitionStatus | undefined;
  const category = COMPETITION_CATEGORIES.find((c) => c === one(sp.category)) as CompetitionCategory | undefined;

  const filters: SQL[] = [];
  if (user.role === "LEAGUE") filters.push(eq(competitions.leagueId, user.leagueId ?? -1));
  else if (organiser === "national") filters.push(isNull(competitions.leagueId));
  else if (organiser && Number(organiser)) filters.push(eq(competitions.leagueId, Number(organiser)));
  if (q) filters.push(ilike(competitions.name, `%${q}%`));
  if (season) filters.push(eq(competitions.season, season));
  if (status) filters.push(eq(competitions.status, status));
  if (category) filters.push(eq(competitions.category, category));

  const [rows, seasons, leagueList] = await Promise.all([
    db
      .select({ c: competitions, league: leagues.name, teams: count(competitionTeams.id) })
      .from(competitions)
      .leftJoin(leagues, eq(competitions.leagueId, leagues.id))
      .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
      .where(filters.length ? and(...filters) : undefined)
      .groupBy(competitions.id, leagues.name)
      .orderBy(desc(competitions.season), competitions.name),
    db.selectDistinct({ season: competitions.season }).from(competitions).orderBy(desc(competitions.season)),
    user.role === "LEAGUE" ? Promise.resolve([]) : leagueOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Sport"
        title="Compétitions"
        description={
          user.role === "LEAGUE"
            ? "Les compétitions organisées par votre ligue : engagements, calendrier, résultats, classements."
            : "Compétitions nationales et championnats départementaux : engagements, calendrier, feuilles de match, classements."
        }
        actions={
          <Link href="/admin/competitions/nouveau" className="admin-btn admin-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden>
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Nouvelle compétition
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: "En préparation", value: rows.filter((r) => r.c.status === "DRAFT").length, sub: "clubs à engager, calendrier à générer" },
          { label: "En cours", value: rows.filter((r) => r.c.status === "ONGOING").length },
          { label: "Terminées", value: rows.filter((r) => r.c.status === "FINISHED").length },
          { label: "Départementales", value: rows.filter((r) => r.c.leagueId !== null).length, sub: `${rows.filter((r) => r.c.leagueId === null).length} nationale(s)` },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom de la compétition" className="admin-input" style={{ maxWidth: 240 }} />
        </label>
        <SelectField label="Saison" name="season" defaultValue={season ?? ""}>
          <option value="">Toutes</option>
          {seasons.map((s) => (
            <option key={s.season} value={s.season}>
              {seasonLabel(s.season)}
            </option>
          ))}
        </SelectField>
        {user.role !== "LEAGUE" && (
          <SelectField label="Organisateur" name="organiser" defaultValue={organiser ?? ""}>
            <option value="">Tous</option>
            <option value="national">Fédération (nationales)</option>
            {leagueList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Catégorie" name="category" defaultValue={category ?? ""}>
          <option value="">Toutes</option>
          {COMPETITION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {COMPETITION_CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Statut" name="status" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          {COMPETITION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMPETITION_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["Compétition", "Organisateur", "Saison", "Type", "Catégorie", "Clubs", "Statut", ""]} pageSize={5}>
        {rows.map(({ c, league, teams }) => (
          <tr key={c.id} data-testid="competition-row">
            <td>
              <Link href={`/admin/competitions/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="text-sm">{league ?? <span className="font-semibold">Fédération</span>}</td>
            <td>{seasonLabel(c.season)}</td>
            <td className="text-sm">{COMPETITION_TYPE_LABELS[c.type]}</td>
            <td className="text-sm">
              {COMPETITION_CATEGORY_LABELS[c.category]}
              {c.gender === "F" ? " · Féminin" : ""}
            </td>
            <td className="tabular-nums">{teams}</td>
            <td>
              <StatusBadge tone={c.status === "ONGOING" ? "ok" : c.status === "DRAFT" ? "wait" : "neutral"}>{COMPETITION_STATUS_LABELS[c.status]}</StatusBadge>
            </td>
            <td>
              <RowActions
                name={c.name}
                viewHref={`/admin/competitions/${c.id}`}
                editHref={`/admin/competitions/${c.id}#modifier`}
                onDelete={c.status === "DRAFT" ? deleteCompetition.bind(null, c.id) : undefined}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="text-center text-muted-foreground">
              Aucune compétition ne correspond.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}
