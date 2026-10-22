import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { deletePlayer } from "./actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { and, asc, count, countDistinct, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { SelectField } from "@/components/ui/field";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, licenses, players } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { POSITION_LABELS, seasonLabel, seasonOf } from "@/lib/licenses";
import { scopedClubOptions } from "@/lib/queries/reference";

export const metadata: Metadata = { title: "Joueurs — FECOFOOT" };

const PAGE_SIZE = 5;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function PlayersPage({ searchParams }: PageProps<"/admin/joueurs">) {
  const user = await requirePermission("players.read");
  const canManage = can(user.role, "players.manage");
  const sp = await searchParams;
  const q = one(sp.q);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const clubChoices = await scopedClubOptions(user);
  const requestedClub = Number(one(sp.club)) || undefined;

  const filters: SQL[] = [];
  // Périmètre : club → ses joueurs ; ligue → joueurs des clubs de sa ligue.
  if (user.role === "CLUB") filters.push(eq(players.clubId, user.clubId ?? -1));
  if (user.role === "LEAGUE") filters.push(eq(clubs.leagueId, user.leagueId ?? -1));
  if (requestedClub && clubChoices.some((c) => c.id === requestedClub)) filters.push(eq(players.clubId, requestedClub));
  if (q) {
    filters.push(
      or(ilike(players.lastName, `%${q}%`), ilike(players.firstName, `%${q}%`), ilike(players.federalId, `%${q}%`))!,
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  // Indicateurs dans le périmètre du compte (sans les filtres de recherche).
  const scope = user.role === "CLUB" ? eq(players.clubId, user.clubId ?? -1) : user.role === "LEAGUE" ? eq(clubs.leagueId, user.leagueId ?? -1) : undefined;
  const [[{ all }], [{ women }], [{ minors }], [{ licensed }]] = await Promise.all([
    db.select({ all: count() }).from(players).leftJoin(clubs, eq(players.clubId, clubs.id)).where(scope),
    db.select({ women: count() }).from(players).leftJoin(clubs, eq(players.clubId, clubs.id)).where(and(scope, eq(players.gender, "F"))),
    db.select({ minors: count() }).from(players).leftJoin(clubs, eq(players.clubId, clubs.id)).where(and(scope, gt(players.birthDate, sql`now() - interval '18 years'`))),
    db
      .select({ licensed: countDistinct(licenses.playerId) })
      .from(licenses)
      .innerJoin(clubs, eq(licenses.clubId, clubs.id))
      .where(and(scope, eq(licenses.season, seasonOf()), eq(licenses.status, "VALIDATED"))),
  ]);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: players.id,
        federalId: players.federalId,
        lastName: players.lastName,
        firstName: players.firstName,
        birthDate: players.birthDate,
        position: players.position,
        club: clubs.name,
      })
      .from(players)
      .leftJoin(clubs, eq(players.clubId, clubs.id))
      .where(where)
      .orderBy(asc(players.lastName), asc(players.firstName))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(players).leftJoin(clubs, eq(players.clubId, clubs.id)).where(where),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/admin/joueurs?${new URLSearchParams({ ...(q && { q }), ...(requestedClub && { club: String(requestedClub) }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        eyebrow="Licences"
        title="Joueurs"
        description={`${total} joueur(s) enregistré(s)`}
        actions={
          can(user.role, "players.manage") && (
            <Link href="/admin/joueurs/nouveau" className="admin-btn admin-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden><path d="M12 5v14m-7-7h14" /></svg>
              Nouveau joueur
            </Link>
          )
        }
      />
      <StatCards
        stats={[
          { label: "Joueurs", value: all },
          { label: `Licenciés ${seasonLabel(seasonOf())}`, value: licensed, sub: all ? `${Math.round((licensed / all) * 100)} % des joueurs` : undefined },
          { label: "Joueuses", value: women },
          { label: "Mineurs", value: minors, sub: "accord du représentant légal requis" },
        ]}
      />

      <form className="mb-5 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="admin-label">Recherche</span>
          <input name="q" defaultValue={q} placeholder="Nom, prénom, identifiant" className="admin-input" style={{ maxWidth: 260 }} />
        </label>
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
        <button type="submit" className="admin-btn admin-btn-outline">
          Filtrer
        </button>
      </form>

      <DataTable head={["Identifiant", "Joueur", "Naissance", "Poste", "Club", ""]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="px-3 py-2 font-mono text-xs">{p.federalId}</td>
            <td className="px-3 py-2">
              <Link href={`/admin/joueurs/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                {p.lastName} {p.firstName}
              </Link>
            </td>
            <td className="px-3 py-2">{formatDate(p.birthDate)}</td>
            <td className="px-3 py-2">{p.position ? POSITION_LABELS[p.position] : "—"}</td>
            <td className="px-3 py-2">{p.club ?? "—"}</td>
            <td>
              <RowActions name={`${p.lastName} ${p.firstName}`} viewHref={`/admin/joueurs/${p.id}`} editHref={canManage ? `/admin/joueurs/${p.id}#modifier` : undefined} onDelete={canManage ? deletePlayer.bind(null, p.id) : undefined} />
            </td>
          </tr>
        ))}
      </DataTable>

      <Pager page={page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={href} />
    </>
  );
}
