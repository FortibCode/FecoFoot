import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { isLocked } from "@/lib/auth/lockout";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { clubs, leagues, users } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Utilisateurs — FECOFOOT" };

export default async function UsersPage() {
  await requirePermission("users.manage");

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      active: users.active,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      league: leagues.name,
      club: clubs.name,
    })
    .from(users)
    .leftJoin(leagues, eq(users.leagueId, leagues.id))
    .leftJoin(clubs, eq(users.clubId, clubs.id))
    .orderBy(asc(users.fullName));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description={`${rows.length} compte(s)`}
        actions={
          <Link href="/admin/utilisateurs/nouveau" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Nouveau compte
          </Link>
        }
      />
      <DataTable head={["Nom", "Profil", "Périmètre", "Dernière connexion", "État"]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/utilisateurs/${u.id}`} className="font-medium underline-offset-2 hover:underline">
                {u.fullName}
              </Link>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </td>
            <td className="px-3 py-2">{ROLE_LABELS[u.role]}</td>
            <td className="px-3 py-2">{u.league ?? u.club ?? "—"}</td>
            <td className="px-3 py-2">{formatDateTime(u.lastLoginAt)}</td>
            <td className="px-3 py-2">
              {!u.active ? "Désactivé" : isLocked(u.lockedUntil) ? "Verrouillé" : "Actif"}
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
