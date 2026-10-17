import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";

export const metadata: Metadata = { title: "Tableau de bord — FECOFOOT" };

export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const modules = modulesFor(user.role).filter((m) => m.href !== "/admin");

  return (
    <>
      <div className="brand-band relative mb-8 overflow-hidden rounded-2xl p-6 md:p-8">
        <BrandLogo size={150} decorative className="absolute -right-6 -bottom-8 hidden opacity-25 sm:block" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--flag-yellow)]">Pilotage</p>
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">Tableau de bord</h1>
        <p className="mt-2 text-sm text-white/75">
          Bonjour {user.fullName} · {ROLE_LABELS[user.role]}
        </p>
      </div>

      <h2 className="mb-3 text-lg font-bold uppercase">Vos modules</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <li key={m.href}>
            {m.ready ? (
              <Link
                href={m.href}
                className="group flex h-full items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--flag-green)] hover:shadow-md"
              >
                <span>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{m.group}</span>
                  <span className="block font-semibold">{m.label}</span>
                </span>
                <span aria-hidden className="text-lg text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[var(--flag-green)]">
                  →
                </span>
              </Link>
            ) : (
              <div className="h-full rounded-xl border border-dashed p-4 text-muted-foreground">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.15em]">{m.group}</span>
                <span className="block font-semibold">{m.label}</span>
                <span className="text-xs">En cours de développement</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
