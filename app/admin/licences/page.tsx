import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { and, count, desc, eq, gt, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { licenseTone, StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, licenses, players } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { cardIssued, CATEGORIES, CATEGORY_LABELS, effectiveStatus, LICENSE_STATUS_LABELS, LICENSE_STATUSES, seasonLabel, seasonOf, type LicenseStatus } from "@/lib/licenses";
import { leagueOptions, scopedClubOptions } from "@/lib/queries/reference";

export const metadata: Metadata = { title: "Licences des joueurs — FECOFOOT" };

const PAGE_SIZE = 5;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Tableau de bord des licences par statut, saison et club (EF-LIC-08). */
export default async function LicensesPage({ searchParams }: PageProps<"/admin/licences">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const sp = await searchParams;
  const season = Number(one(sp.season)) || seasonOf();
  const status = LICENSE_STATUSES.find((s) => s === one(sp.status)) as LicenseStatus | undefined;
  const etat = (["active", "attente", "expiree", "suspendue", "revoquee"] as const).find((e) => e === one(sp.etat));
  const category = CATEGORIES.find((c) => c === one(sp.category));
  const league = user.role === "LEAGUE" || user.role === "CLUB" ? undefined : Number(one(sp.league)) || undefined;
  const q = one(sp.q);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const clubChoices = await scopedClubOptions(user);
  const requestedClub = Number(one(sp.club)) || undefined;

  const scope: SQL[] = [eq(licenses.season, season)];
  if (user.role === "CLUB") scope.push(eq(licenses.clubId, user.clubId ?? -1));
  if (user.role === "LEAGUE") scope.push(eq(clubs.leagueId, user.leagueId ?? -1));
  if (requestedClub && clubChoices.some((c) => c.id === requestedClub)) scope.push(eq(licenses.clubId, requestedClub));

  if (league) scope.push(eq(clubs.leagueId, league));
  if (category) scope.push(eq(licenses.category, category));

  const filters = [...scope];
  if (status) filters.push(eq(licenses.status, status));
  // États lisibles par le public (carte) : active, en attente d'instruction, expirée, suspendue, révoquée.
  if (etat === "active") filters.push(eq(licenses.status, "VALIDATED"), gt(licenses.expiresAt, sql`now()`));
  if (etat === "attente") filters.push(inArray(licenses.status, ["PENDING", "PAID", "TO_CORRECT"]));
  if (etat === "expiree") filters.push(or(eq(licenses.status, "EXPIRED"), and(inArray(licenses.status, ["VALIDATED", "SUSPENDED"]), lt(licenses.expiresAt, sql`now()`)))!);
  if (etat === "suspendue") filters.push(eq(licenses.status, "SUSPENDED"));
  if (etat === "revoquee") filters.push(eq(licenses.status, "REVOKED"));
  if (q) filters.push(or(ilike(players.lastName, `%${q}%`), ilike(players.firstName, `%${q}%`), ilike(licenses.number, `%${q}%`), ilike(clubs.name, `%${q}%`))!);

  const [rows, [{ total }], [counts], leagueList] = await Promise.all([
    db
      .select({
        id: licenses.id,
        number: licenses.number,
        status: licenses.status,
        expiresAt: licenses.expiresAt,
        category: licenses.category,
        createdAt: licenses.createdAt,
        lastName: players.lastName,
        firstName: players.firstName,
        club: clubs.shortName,
        clubName: clubs.name,
      })
      .from(licenses)
      .innerJoin(players, eq(licenses.playerId, players.id))
      .innerJoin(clubs, eq(licenses.clubId, clubs.id))
      .where(and(...filters))
      .orderBy(desc(licenses.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(licenses)
      .innerJoin(players, eq(licenses.playerId, players.id))
      .innerJoin(clubs, eq(licenses.clubId, clubs.id))
      .where(and(...filters)),
    db
      .select({
        active: sql<number>`count(*) filter (where ${licenses.status} = 'VALIDATED' and ${licenses.expiresAt} > now())::int`,
        pending: sql<number>`count(*) filter (where ${licenses.status} in ('PENDING', 'PAID', 'TO_CORRECT'))::int`,
        expired: sql<number>`count(*) filter (where ${licenses.status} = 'EXPIRED' or (${licenses.status} in ('VALIDATED', 'SUSPENDED') and ${licenses.expiresAt} <= now()))::int`,
        suspended: sql<number>`count(*) filter (where ${licenses.status} = 'SUSPENDED')::int`,
        revoked: sql<number>`count(*) filter (where ${licenses.status} = 'REVOKED')::int`,
      })
      .from(licenses)
      .innerJoin(clubs, eq(licenses.clubId, clubs.id))
      .where(and(...scope)),
    user.role === "LEAGUE" || user.role === "CLUB" ? Promise.resolve([]) : leagueOptions(),
  ]);

  const params = (extra: Record<string, string>) =>
    `/admin/licences?${new URLSearchParams({
      season: String(season),
      ...(requestedClub && { club: String(requestedClub) }),
      ...(league && { league: String(league) }),
      ...(category && { category }),
      ...(q && { q }),
      ...extra,
    })}`;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentSeason = seasonOf();

  return (
    <>
      <PageHeader
        eyebrow="Licences"
        title={`Licences ${seasonLabel(season)}`}
        description={`${total} licence(s) affichée(s)`}
        actions={
          <>
            {(requestedClub || user.role === "CLUB") && (
              <>
                <a href={`/admin/exports/licences?club=${requestedClub ?? ""}&season=${season}&format=xlsx`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  Excel
                </a>
                <a href={`/admin/exports/licences?club=${requestedClub ?? ""}&season=${season}&format=pdf`} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  PDF
                </a>
              </>
            )}
            <Link href="/admin/licences/renouvellement" className="admin-btn admin-btn-outline">
              Renouvellement groupé
            </Link>
          </>
        }
      />

      <StatCards
        label="Licences par état"
        stats={(
          [
            ["active", "Actives", counts.active],
            ["attente", "En attente", counts.pending],
            ["expiree", "Expirées", counts.expired],
            ["suspendue", "Suspendues", counts.suspended],
            ["revoquee", "Révoquées", counts.revoked],
          ] as const
        ).map(([key, label, value]) => ({ label, value, href: params(etat === key ? {} : { etat: key }), active: etat === key }))}
      />

      <form aria-label="Filtres" className="text-sm">
        {status && <input type="hidden" name="status" value={status} />}
        {etat && <input type="hidden" name="etat" value={etat} />}
        <SelectField label="Saison" name="season" defaultValue={season}>
          {[currentSeason + 1, currentSeason, currentSeason - 1, currentSeason - 2].map((s) => (
            <option key={s} value={s}>
              {seasonLabel(s)}
            </option>
          ))}
        </SelectField>
        {clubChoices.length > 1 && (
          <SelectField label="Club" name="club" defaultValue={requestedClub ?? ""}>
            <option value="">Tous</option>
            {clubChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        )}
        {leagueList.length > 0 && (
          <SelectField label="Ligue" name="league" defaultValue={league ?? ""}>
            <option value="">Toutes</option>
            {leagueList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Catégorie" name="category" defaultValue={category ?? ""}>
          <option value="">Toutes</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectField>
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Joueur, n° de licence, club" className="admin-input" style={{ maxWidth: 240 }} />
        </label>
        <button type="submit">Filtrer</button>
      </form>

      <DataTable head={["N°", "Joueur", "Club", "Catégorie", "Déposée le", "Statut", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="text-center text-muted-foreground">
              Aucune licence ne correspond.
            </td>
          </tr>
        )}
        {rows.map((l) => (
          <tr key={l.id}>
            <td className="px-3 py-2 font-mono text-xs">
              <Link href={`/admin/licences/${l.id}`} className="underline-offset-2 hover:underline">
                {l.number}
              </Link>
            </td>
            <td className="px-3 py-2 font-medium">
              {l.lastName} {l.firstName}
            </td>
            <td className="px-3 py-2" title={l.clubName}>
              {l.club ?? l.clubName}
            </td>
            <td className="px-3 py-2">{CATEGORY_LABELS[l.category]}</td>
            <td className="px-3 py-2">{formatDate(l.createdAt)}</td>
            <td className="px-3 py-2">
              <StatusBadge tone={licenseTone(effectiveStatus(l.status, l.expiresAt))}>{LICENSE_STATUS_LABELS[effectiveStatus(l.status, l.expiresAt)]}</StatusBadge>
            </td>
            <td>
              <RowActions name={l.number} viewHref={`/admin/licences/${l.id}`} />
              {cardIssued(l.status) && (
                <Link href={`/admin/licences/${l.id}/carte`} className="ml-2 text-xs font-semibold underline-offset-2 hover:underline">
                  Carte
                </Link>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager page={page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => params({ ...(status && { status }), page: String(p) })} />
    </>
  );
}
