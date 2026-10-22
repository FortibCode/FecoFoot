import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import { StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { COMPETITION_STATUS_LABELS } from "@/lib/competitions";
import { db } from "@/lib/db";
import { clubs, competitions, competitionTeams, leagues, users } from "@/lib/db/schema";
import { seasonLabel } from "@/lib/licenses";
import { deleteLeague, setLeagueActive } from "./actions";

export const metadata: Metadata = { title: "Ligues — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const SORTS = { name: asc(leagues.name), department: asc(leagues.department), clubs: desc(sql`club_count`) } as const;

/**
 * Ligues départementales (EF-CLB-01) et divisions nationales : synthèse, recherche, filtres, tri.
 * Un responsable départemental est conduit directement à la fiche de sa ligue.
 */
export default async function LeaguesPage({ searchParams }: PageProps<"/admin/ligues">) {
  const user = await requireAnyPermission("leagues.manage", "leagues.own");
  if (!can(user.role, "leagues.manage")) redirect(user.leagueId ? `/admin/ligues/${user.leagueId}` : "/admin/acces-refuse");

  const sp = await searchParams;
  const q = one(sp.q);
  const state = one(sp.state);
  const sort = (one(sp.sort) ?? "name") as keyof typeof SORTS;

  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(leagues.name, `%${q}%`), ilike(leagues.code, `%${q}%`), ilike(leagues.department, `%${q}%`))!);
  if (state === "active") filters.push(eq(leagues.active, true));
  if (state === "inactive") filters.push(eq(leagues.active, false));

  const [rows, nationals, [{ federal }]] = await Promise.all([
    db
      .select({
        id: leagues.id,
        code: leagues.code,
        name: leagues.name,
        department: leagues.department,
        president: leagues.president,
        email: leagues.email,
        phone: leagues.phone,
        active: leagues.active,
        clubCount: sql<number>`count(${clubs.id})::int`.as("club_count"),
        affiliated: sql<number>`count(${clubs.id}) filter (where ${clubs.status} = 'AFFILIATED')::int`,
        accounts: sql<number>`(select count(*)::int from ${users} where ${users.leagueId} = ${leagues.id})`,
        competitionsCount: sql<number>`(select count(*)::int from ${competitions} where ${competitions.leagueId} = ${leagues.id})`,
      })
      .from(leagues)
      .leftJoin(clubs, eq(clubs.leagueId, leagues.id))
      .where(filters.length ? and(...filters) : undefined)
      .groupBy(leagues.id)
      .orderBy(SORTS[sort] ?? SORTS.name, asc(leagues.name)),
    // Divisions nationales : championnats organisés par la fédération (Ligue 1, Ligue 2…).
    db
      .select({ c: competitions, teams: count(competitionTeams.id) })
      .from(competitions)
      .leftJoin(competitionTeams, eq(competitionTeams.competitionId, competitions.id))
      .where(and(isNull(competitions.leagueId), eq(competitions.type, "LEAGUE")))
      .groupBy(competitions.id)
      .orderBy(desc(competitions.season), asc(competitions.name)),
    db.select({ federal: count() }).from(clubs).where(isNull(clubs.leagueId)),
  ]);

  const complete = (l: (typeof rows)[number]) => Boolean(l.president && (l.email || l.phone));

  return (
    <>
      <PageHeader
        eyebrow="Organisation"
        title="Ligues et divisions"
        description="Les ligues départementales (clubs, compétitions, comptes) et les divisions nationales organisées par la fédération."
        actions={
          <Link href="/admin/ligues/nouvelle" className="admin-btn admin-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden>
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Nouvelle ligue
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: "Ligues départementales", value: rows.filter((l) => l.active).length, sub: `${rows.filter((l) => !l.active).length} désactivée(s)` },
          { label: "Clubs départementaux", value: rows.reduce((a, l) => a + l.clubCount, 0), sub: `${federal} club(s) en division nationale` },
          { label: "Fiches complètes", value: `${rows.filter(complete).length} / ${rows.length}`, sub: "président et contact renseignés" },
          { label: "Divisions nationales", value: nationals.length, sub: "championnats de la fédération" },
        ]}
      />

      <section className="flex flex-col gap-3" aria-labelledby="divisions">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="divisions">Divisions nationales</h2>
          <Link href="/admin/championnats" className="admin-btn admin-btn-outline">
            Gérer les championnats nationaux →
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Ligue 1 et Ligue 2, organisées par la fédération et distinctes des ligues départementales. Un club y participe par son engagement de la saison et garde sa ligue
          d&apos;origine.
        </p>
        <DataTable head={["Division", "Saison", "Clubs engagés", "Statut", ""]}>
          {nationals.map(({ c, teams }) => (
            <tr key={c.id} data-testid="division-row">
              <td>
                <Link href={`/admin/competitions/${c.id}`} className="font-semibold">
                  {c.name}
                </Link>
              </td>
              <td>{seasonLabel(c.season)}</td>
              <td className="tabular-nums">{teams}</td>
              <td>
                <StatusBadge tone={c.status === "ONGOING" ? "ok" : c.status === "DRAFT" ? "wait" : "neutral"}>{COMPETITION_STATUS_LABELS[c.status]}</StatusBadge>
              </td>
              <td>
                <RowActions name={c.name} viewHref={`/admin/competitions/${c.id}`} editHref={`/admin/competitions/${c.id}#modifier`} />
              </td>
            </tr>
          ))}
          {nationals.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted-foreground">
                Aucune division nationale. Créez-la depuis Compétitions (organisateur : Fédération).
              </td>
            </tr>
          )}
        </DataTable>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="departementales">
        <h2 id="departementales">Ligues départementales</h2>
        <form aria-label="Filtres" className="text-sm">
          <label>
            Recherche
            <input name="q" defaultValue={q} placeholder="Nom, code, département" className="admin-input" style={{ maxWidth: 240 }} />
          </label>
          <SelectField label="État" name="state" defaultValue={state ?? ""}>
            <option value="">Toutes</option>
            <option value="active">Actives</option>
            <option value="inactive">Désactivées</option>
          </SelectField>
          <SelectField label="Trier par" name="sort" defaultValue={sort}>
            <option value="name">Nom</option>
            <option value="department">Département</option>
            <option value="clubs">Nombre de clubs</option>
          </SelectField>
          <button type="submit">Filtrer</button>
        </form>
        <DataTable head={["Ligue", "Département", "Président", "Clubs", "Compétitions", "Fiche", ""]} pageSize={5}>
          {rows.map((l) => (
            <tr key={l.id} data-testid="league-row" className={l.active ? undefined : "opacity-60"}>
              <td>
                <span className="flex items-center gap-3">
                  <span className="league-code">{l.code}</span>
                  <Link href={`/admin/ligues/${l.id}`}>{l.name}</Link>
                </span>
              </td>
              <td>{l.department ?? <span className="text-muted-foreground">—</span>}</td>
              <td>{l.president ?? <span className="text-muted-foreground">Non renseigné</span>}</td>
              <td>
                <Link href={`/admin/clubs?league=${l.id}`} className="tabular-nums">
                  {l.affiliated}
                  {l.clubCount !== l.affiliated && <span className="font-normal text-muted-foreground"> / {l.clubCount}</span>}
                </Link>
              </td>
              <td className="tabular-nums">{l.competitionsCount}</td>
              <td>
                {l.active ? (
                  <StatusBadge tone={complete(l) ? "ok" : "wait"}>{complete(l) ? "Complète" : "À compléter"}</StatusBadge>
                ) : (
                  <StatusBadge tone="bad">Désactivée</StatusBadge>
                )}
              </td>
              <td>
                <RowActions
                  name={l.name}
                  viewHref={`/admin/ligues/${l.id}`}
                  editHref={`/admin/ligues/${l.id}#modifier`}
                  toggle={{ label: l.active ? "Désactiver" : "Réactiver", danger: l.active, action: setLeagueActive.bind(null, l.id, !l.active) }}
                  onDelete={deleteLeague.bind(null, l.id)}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted-foreground">
                Aucune ligue ne correspond.
              </td>
            </tr>
          )}
        </DataTable>
      </section>
    </>
  );
}
