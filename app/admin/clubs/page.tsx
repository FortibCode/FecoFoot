import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { deleteClub } from "./actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SelectField } from "@/components/ui/field";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { CLUB_STATUS_LABELS, CLUB_STATUSES, type ClubStatus } from "@/lib/clubs";
import { db } from "@/lib/db";
import { clubs, leagues } from "@/lib/db/schema";
import { leagueOptions } from "@/lib/queries/reference";

export const metadata: Metadata = { title: "Clubs — FECOFOOT" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function ClubsPage({ searchParams }: PageProps<"/admin/clubs">) {
  const user = await requirePermission("clubs.read");
  const canManage = can(user.role, "clubs.manage");
  // Un club ne voit que sa propre fiche (EF-CLB-04).
  if (user.role === "CLUB") redirect(user.clubId ? `/admin/clubs/${user.clubId}` : "/admin/acces-refuse");

  const sp = await searchParams;
  const q = one(sp.q);
  const status = CLUB_STATUSES.find((s) => s === one(sp.status)) as ClubStatus | undefined;
  const leagueFilter = user.role === "LEAGUE" ? user.leagueId : Number(one(sp.league)) || undefined;
  // « national » : clubs rattachés directement à la fédération (divisions nationales).
  const nationalOnly = user.role !== "LEAGUE" && one(sp.league) === "national";

  const filters: SQL[] = [];
  if (leagueFilter) filters.push(eq(clubs.leagueId, leagueFilter));
  if (nationalOnly) filters.push(isNull(clubs.leagueId));
  if (status) filters.push(eq(clubs.status, status));
  if (q) filters.push(or(ilike(clubs.name, `%${q}%`), ilike(clubs.affiliationNumber, `%${q}%`), ilike(clubs.city, `%${q}%`))!);

  const [rows, allLeagues] = await Promise.all([
    db
      .select({
        id: clubs.id,
        affiliationNumber: clubs.affiliationNumber,
        name: clubs.name,
        city: clubs.city,
        status: clubs.status,
        league: leagues.name,
      })
      .from(clubs)
      .leftJoin(leagues, eq(clubs.leagueId, leagues.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(clubs.name)),
    user.role === "LEAGUE" ? Promise.resolve([]) : leagueOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Organisation"
        title="Clubs"
        description={`${rows.length} club(s)`}
        actions={
          can(user.role, "clubs.manage") && (
            <Link href="/admin/clubs/nouveau" className="admin-btn admin-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden><path d="M12 5v14m-7-7h14" /></svg>
              Nouveau club
            </Link>
          )
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="admin-label">Recherche</span>
          <input name="q" defaultValue={q} placeholder="Nom, n° d'affiliation, ville" className="admin-input" style={{ maxWidth: 260 }} />
        </label>
        {allLeagues.length > 0 && (
          <SelectField label="Rattachement" name="league" defaultValue={nationalOnly ? "national" : (leagueFilter ?? "")}>
            <option value="">Tous</option>
            <option value="national">Fédération — division nationale</option>
            {allLeagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Statut" name="status" defaultValue={status ?? ""}>
          <option value="">Tous</option>
          {CLUB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLUB_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <button type="submit" className="admin-btn admin-btn-outline">
          Filtrer
        </button>
      </form>

      <DataTable head={["N° d'affiliation", "Club", "Ville", "Ligue", "Statut", ""]} pageSize={5}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="px-3 py-2 font-mono text-xs">{c.affiliationNumber}</td>
            <td className="px-3 py-2">
              <Link href={`/admin/clubs/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="px-3 py-2">{c.city}</td>
            <td className="px-3 py-2">{c.league ?? "Fédération (nationale)"}</td>
            <td className="px-3 py-2"><StatusBadge tone={c.status === "AFFILIATED" ? "ok" : c.status === "PENDING" ? "wait" : "neutral"}>{CLUB_STATUS_LABELS[c.status]}</StatusBadge></td>
            <td>
              <RowActions name={c.name} viewHref={`/admin/clubs/${c.id}`} editHref={canManage ? `/admin/clubs/${c.id}#modifier` : undefined} onDelete={canManage ? deleteClub.bind(null, c.id) : undefined} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
