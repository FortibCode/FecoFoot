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
      {/* ══════════════════════════════════════════════
          HEADER — fond blanc, barre de recherche
          ══════════════════════════════════════════════ */}
      <header className="admin-header print:hidden">
        {/* Zone logo — alignée avec le rail d'icônes */}
        <div className="admin-header-logo-zone">
          <Link href="/admin" aria-label="Tableau de bord FECOFOOT">
            <BrandLogo size={34} decorative />
          </Link>
        </div>

        {/* Branding textuel */}
        <Link href="/admin" className="admin-header-brand">
          <span className="admin-header-brand-text">
            <span className="admin-header-brand-name">FECOFOOT</span>
            <span className="admin-header-brand-sub">Espace fédéral</span>
          </span>
        </Link>

        {/* Barre de recherche */}
        <div className="admin-search-wrap">
          <span className="admin-search-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Rechercher…"
            className="admin-search-input"
            aria-label="Rechercher dans l'espace admin"
          />
        </div>

        {/* Actions droite */}
        <div className="admin-header-actions">
          {/* Notifications */}
          <Link
            href="/admin/notifications"
            className="admin-header-action-btn"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={17} height={17} aria-hidden>
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="admin-notif-dot" aria-hidden />
          </Link>

          <div className="admin-header-sep" aria-hidden />

          {/* Utilisateur + avatar */}
          <Link href="/admin/mon-compte" className="admin-header-user" aria-label="Mon compte">
            <div className="admin-header-user-info">
              <span className="admin-header-user-name">{user.fullName}</span>
              <span className="admin-header-user-role">{ROLE_LABELS[user.role]}</span>
            </div>
            <div className="admin-header-avatar" aria-hidden>
              {initials}
            </div>
            <span className="admin-header-user-chevron" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={13} height={13}>
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </Link>

          {/* Déconnexion */}
          <form action={logout}>
            <button type="submit" className="admin-logout-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden>
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          BODY — Sidebar 2 colonnes + Contenu
          ══════════════════════════════════════════════ */}
      <div className="admin-body">
        <AdminNav
          modules={modules.map(({ href, label, group, ready }) => ({
            href,
            label,
            group,
            ready,
          }))}
        />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
