import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { logout } from "@/app/connexion/actions";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Le gabarit s'affiche aussi sur la page d'activation de la double authentification.
  const user = await requireUser({ allowTwoFactorSetup: true });
  const modules = modulesFor(user.role);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="brand-band flex items-center justify-between gap-4 px-4 py-2.5 md:px-6 print:hidden">
        <Link href="/admin" className="flex items-center gap-3">
          <BrandLogo size={38} decorative />
          <span className="flex flex-col leading-none">
            <span className="font-heading text-lg font-bold tracking-wide">FECOFOOT</span>
            <span className="mt-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-white/60">Espace fédéral</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-right">
          <div className="hidden sm:block">
            <Link href="/admin/mon-compte" className="text-sm font-semibold leading-tight underline-offset-2 hover:underline">
              {user.fullName}
            </Link>
            <p className="text-xs text-white/60">{ROLE_LABELS[user.role]}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <div className="flag-stripe h-1 print:hidden" />

      <div className="flex flex-1 flex-col md:flex-row">
        <AdminNav modules={modules.map(({ href, label, group, ready }) => ({ href, label, group, ready }))} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
