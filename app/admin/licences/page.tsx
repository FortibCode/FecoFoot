import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { licenseTone, StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requireAnyPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { clubs, licenses, players } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { CATEGORY_LABELS, LICENSE_STATUS_LABELS, LICENSE_STATUSES, seasonLabel, seasonOf, type LicenseStatus } from "@/lib/licenses";
import { scopedClubOptions } from "@/lib/queries/reference";

export const metadata: Metadata = { title: "Licences — FECOFOOT" };

const PAGE_SIZE = 5;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Tableau de bord des licences par statut, saison et club (EF-LIC-08). */
export default async function LicensesPage({ searchParams }: PageProps<"/admin/licences">) {
  const user = await requireAnyPermission("licenses.validate", "licenses.request");
  const sp = await searchParams;
  const season = Number(one(sp.season)) || seasonOf();
  const status = LICENSE_STATUSES.find((s) => s === one(sp.status)) as LicenseStatus | undefined;
  const q = one(sp.q);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const clubChoices = await scopedClubOptions(user);
  const requestedClub = Number(one(sp.club)) || undefined;

  const scope: SQL[] = [eq(licenses.season, season)];
  if (user.role === "CLUB") scope.push(eq(licenses.clubId, user.clubId ?? -1));
  if (user.role === "LEAGUE") scope.push(eq(clubs.leagueId, user.leagueId ?? -1));
  if (requestedClub && clubChoices.some((c) => c.id === requestedClub)) scope.push(eq(licenses.clubId, requestedClub));

  const filters = [...scope];
  if (status) filters.push(eq(licenses.status, status));
  if (q) filters.push(or(ilike(players.lastName, `%${q}%`), ilike(players.firstName, `%${q}%`), ilike(licenses.number, `%${q}%`))!);

  const [rows, [{ total }], byStatus] = await Promise.all([
    db
      .select({
        id: licenses.id,
        number: licenses.number,
        status: licenses.status,
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
      .select({ status: licenses.status, n: count() })
      .from(licenses)
      .innerJoin(clubs, eq(licenses.clubId, clubs.id))
      .where(and(...scope))
      .groupBy(licenses.status),
  ]);

  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<Record<LicenseStatus, number>>;
  const params = (extra: Record<string, string>) =>
    `/admin/licences?${new URLSearchParams({
      season: String(season),
      ...(requestedClub && { club: String(requestedClub) }),
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
        label="Licences par statut"
        stats={LICENSE_STATUSES.filter((s) => s !== "EXPIRED").map((s) => ({
          label: LICENSE_STATUS_LABELS[s],
          value: counts[s] ?? 0,
          href: params(status === s ? {} : { status: s }),
          active: status === s,
        }))}
      />

      <form className="mb-4 grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-end">
        {status && <input type="hidden" name="status" value={status} />}
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
        <label className="flex flex-col gap-1.5 font-medium">
          Recherche
          <input name="q" defaultValue={q} placeholder="Joueur ou n° de licence" className="admin-input" style={{ maxWidth: 260 }} />
        </label>
        <button type="submit" className="admin-btn admin-btn-outline">
          Filtrer
        </button>
      </form>

      <DataTable head={["N°", "Joueur", "Club", "Catégorie", "Déposée le", "Statut", ""]}>
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
              <StatusBadge tone={licenseTone(l.status)}>{LICENSE_STATUS_LABELS[l.status]}</StatusBadge>
            </td>
            <td>
              <RowActions name={l.number} viewHref={`/admin/licences/${l.id}`} />
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager page={page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => params({ ...(status && { status }), page: String(p) })} />
    </>
  );
}
