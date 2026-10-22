import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { logout } from "@/app/connexion/actions";
import { requireUser } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { modulesFor } from "@/lib/modules";
import { AdminNav } from "@/components/admin/admin-nav";
import "./admin.css";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Le gabarit s'affiche aussi sur la page d'activation de la double authentification.
  const user = await requireUser({ allowTwoFactorSetup: true });
  const modules = modulesFor(user.role);

  // Initiales pour l'avatar
  const initials = user.fullName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="admin-root">
      {/* Écusson FECOFOOT en filigrane, fixe derrière le contenu. */}
      <div aria-hidden className="admin-watermark print:hidden" />

      {/* Barre latérale flottante (marque + modules). */}
      <AdminNav
        modules={modules.map(({ href, label, group, section, ready }) => ({ href, label, group, section, ready }))}
        brand={
          <Link href="/admin" className="admin-side-brand" aria-label="Tableau de bord FECOFOOT">
            <BrandLogo size={42} decorative />
            <span className="admin-side-brand-text">
              <span className="admin-side-brand-name">FECOFOOT</span>
              <span className="admin-side-brand-sub">Espace fédéral</span>
            </span>
          </Link>
        }
      />

      <div className="admin-shell">
        {/* Barre du haut : recherche globale, notifications, compte. */}
        <header className="admin-topbar print:hidden">
          <Link href="/admin" className="admin-topbar-logo" aria-label="Tableau de bord FECOFOOT">
            <BrandLogo size={36} decorative />
          </Link>
          <form action="/admin/recherche" role="search" className="admin-search-wrap">
            <span className="admin-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
                <circle cx="11" cy="11" r="7.5" />
                <path d="M20.5 20.5l-4.2-4.2" />
              </svg>
            </span>
            <input
              type="search"
              name="q"
              minLength={2}
              placeholder="Rechercher un club, un joueur, une licence…"
              className="admin-search-input"
              aria-label="Rechercher dans l'espace fédéral"
            />
          </form>
          <div className="admin-header-actions">
            <Link href="/admin/notifications" className="admin-header-action-btn" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={18} height={18} aria-hidden>
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Link>
            <Link href="/admin/mon-compte" className="admin-header-user" aria-label="Mon compte">
              <div className="admin-header-avatar" aria-hidden>
                {initials}
              </div>
              <div className="admin-header-user-info">
                <span className="admin-header-user-name">{user.fullName}</span>
                <span className="admin-header-user-role">{ROLE_LABELS[user.role]}</span>
              </div>
            </Link>
            <form action={logout}>
              <button type="submit" className="admin-logout-btn" aria-label="Déconnexion">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Déconnexion</span>
              </button>
            </form>
          </div>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
