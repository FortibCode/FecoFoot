import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { setUserActive } from "./actions";
import { StatCards } from "@/components/admin/stat-cards";
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
      totpEnabledAt: users.totpEnabledAt,
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
          <Link href="/admin/utilisateurs/nouveau" className="admin-btn admin-btn-primary">
            Nouveau compte
          </Link>
        }
      />
      <StatCards
        stats={[
          { label: "Comptes", value: rows.length },
          { label: "Actifs", value: rows.filter((u) => u.active).length },
          { label: "Double authentification", value: rows.filter((u) => u.totpEnabledAt).length, sub: "comptes protégés" },
          { label: "Verrouillés", value: rows.filter((u) => u.lockedUntil && u.lockedUntil > new Date()).length, sub: "trop d'échecs de connexion" },
        ]}
      />
      <DataTable head={["Nom", "Profil", "Périmètre", "Dernière connexion", "État", ""]} pageSize={5}>
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
            <td>
              <RowActions name={u.fullName} viewHref={`/admin/utilisateurs/${u.id}`} editHref={`/admin/utilisateurs/${u.id}#modifier`} toggle={{ label: u.active ? "Désactiver le compte" : "Réactiver le compte", danger: u.active, action: setUserActive.bind(null, u.id, !u.active) }} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
