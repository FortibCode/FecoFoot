import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
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
  // Un club ne voit que sa propre fiche (EF-CLB-04).
  if (user.role === "CLUB") redirect(user.clubId ? `/admin/clubs/${user.clubId}` : "/admin/acces-refuse");

  const sp = await searchParams;
  const q = one(sp.q);
  const status = CLUB_STATUSES.find((s) => s === one(sp.status)) as ClubStatus | undefined;
  const leagueFilter = user.role === "LEAGUE" ? user.leagueId : Number(one(sp.league)) || undefined;

  const filters: SQL[] = [];
  if (leagueFilter) filters.push(eq(clubs.leagueId, leagueFilter));
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
      .innerJoin(leagues, eq(clubs.leagueId, leagues.id))
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
            <Link href="/admin/clubs/nouveau" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Nouveau club
            </Link>
          )
        }
      />

      <form className="mb-4 grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1.5 font-medium">
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, n° d'affiliation, ville" className="h-10 rounded-md border px-3" />
        </label>
        {allLeagues.length > 0 && (
          <SelectField label="Ligue" name="league" defaultValue={leagueFilter ?? ""}>
            <option value="">Toutes</option>
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
        <button type="submit" className="h-10 rounded-md border px-4 hover:bg-muted">
          Filtrer
        </button>
      </form>

      <DataTable head={["N° d'affiliation", "Club", "Ville", "Ligue", "Statut"]}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="px-3 py-2 font-mono text-xs">{c.affiliationNumber}</td>
            <td className="px-3 py-2">
              <Link href={`/admin/clubs/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="px-3 py-2">{c.city}</td>
            <td className="px-3 py-2">{c.league}</td>
            <td className="px-3 py-2">{CLUB_STATUS_LABELS[c.status]}</td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
