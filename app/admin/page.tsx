import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";

export const metadata: Metadata = { title: "Tableau de bord — FECOFOOT" };

export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const modules = modulesFor(user.role).filter((m) => m.href !== "/admin");

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pilotage</p>
      <h1 className="text-2xl font-bold md:text-3xl">Tableau de bord</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Bonjour {user.fullName} · {ROLE_LABELS[user.role]}
      </p>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider">Vos modules</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <li key={m.href} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{m.code}</p>
            <p className="font-semibold">{m.label}</p>
            <p className="mt-2 text-xs text-muted-foreground">{m.ready ? "Disponible" : "En cours de développement"}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
