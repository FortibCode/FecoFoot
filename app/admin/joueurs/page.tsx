import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { SelectField } from "@/components/ui/field";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, players } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { POSITION_LABELS } from "@/lib/licenses";
import { scopedClubOptions } from "@/lib/queries/reference";

export const metadata: Metadata = { title: "Joueurs — FECOFOOT" };

const PAGE_SIZE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function PlayersPage({ searchParams }: PageProps<"/admin/joueurs">) {
  const user = await requirePermission("players.read");
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
            <Link href="/admin/joueurs/nouveau" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Nouveau joueur
            </Link>
          )
        }
      />

      <form className="mb-4 grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1.5 font-medium">
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, prénom, identifiant" className="h-10 rounded-md border px-3" />
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
        <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
          Filtrer
        </button>
      </form>

      <DataTable head={["Identifiant", "Joueur", "Naissance", "Poste", "Club"]}>
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
          </tr>
        ))}
      </DataTable>

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={href(page - 1)} className="underline">← Précédent</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="underline">Suivant →</Link>}
        </nav>
      )}
    </>
  );
}
