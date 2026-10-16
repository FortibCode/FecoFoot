import Link from "next/link";
import { logout } from "@/app/connexion/actions";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Le gabarit s'affiche aussi sur la page d'activation de la double authentification.
  const user = await requireUser({ allowTwoFactorSetup: true });
  const modules = modulesFor(user.role);
  const groups = [...new Set(modules.map((m) => m.group))];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6 print:hidden">
        <Link href="/admin" className="font-bold tracking-tight">
          FECOFOOT
        </Link>
        <div className="flex items-center gap-3 text-right">
          <div className="hidden sm:block">
            <Link href="/admin/mon-compte" className="text-sm font-semibold leading-tight underline-offset-2 hover:underline">
              {user.fullName}
            </Link>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Modules" className="border-b p-4 md:w-60 md:shrink-0 md:border-r md:border-b-0 print:hidden">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group}</p>
              <ul>
                {modules
                  .filter((m) => m.group === group)
                  .map((m) =>
                    m.ready ? (
                      <li key={m.href}>
                        <Link href={m.href} className="block rounded px-2 py-1 text-sm hover:bg-muted">
                          {m.label}
                        </Link>
                      </li>
                    ) : (
                      <li key={m.href} className="px-2 py-1 text-sm text-muted-foreground" title="Module en cours de développement">
                        {m.label}
                      </li>
                    ),
                  )}
              </ul>
            </div>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
