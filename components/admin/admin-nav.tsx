"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type Item = { href: string; label: string; group: string; ready: boolean };

/* ── Icônes SVG par module ─────────────────────────────────── */
const MODULE_ICONS: Record<string, string> = {
  "/admin":                "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "/admin/ligues":         "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  "/admin/clubs":          "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "/admin/joueurs":        "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  "/admin/licences":       "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  "/admin/transferts":     "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  "/admin/competitions":   "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "/admin/matchs":         "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  "/admin/selections":     "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
  "/admin/actualites":     "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  "/admin/photos":         "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  "/admin/accreditations": "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2",
  "/admin/billetterie":    "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  "/admin/supporters":     "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  "/admin/arbitres":       "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "/admin/espace-arbitre": "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  "/admin/discipline":     "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  "/admin/utilisateurs":   "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  "/admin/notifications":  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  "/admin/journal":        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
};

/** Groupe → icône représentative du rail */
const GROUP_ICONS: Record<string, string> = {
  "Pilotage":          "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "Organisation":      "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  "Licences":          "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  "Sport":             "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "Communication":     "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  "Stade & supporters":"M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  "Arbitrage":         "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  "Administration":    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};

function SvgIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
    >
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={"M" + seg} />
      ))}
    </svg>
  );
}

/**
 * Barre de navigation admin à deux colonnes :
 * - Rail d'icônes sombre (gauche) — une icône par groupe
 * - Panneau de liens (droite) — labels du groupe actif
 */
export function AdminNav({ modules }: { modules: Item[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Ferme la sidebar mobile à chaque changement de route
  useEffect(() => { setOpen(false); }, [pathname]);

  // Module actif (préfixe le plus long)
  const activeHref = modules
    .filter(
      (m) =>
        m.ready &&
        (pathname === m.href ||
          (m.href !== "/admin" && pathname.startsWith(`${m.href}/`)))
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const groups = [...new Set(modules.map((m) => m.group))];

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={`admin-sidebar-overlay${open ? " is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Sidebar */}
      <nav
        aria-label="Navigation principale"
        className={`admin-sidebar${open ? " is-open" : ""} print:hidden`}
      >
        {/* ── Rail d'icônes (colonne gauche sombre) ── */}
        <div className="admin-icon-rail" aria-hidden>
          {groups.map((group) => {
            const groupModules = modules.filter((m) => m.group === group);
            const isGroupActive = groupModules.some((m) => m.href === activeHref);
            const iconPath = GROUP_ICONS[group] ?? "M4 6h16M4 10h16M4 14h16M4 18h16";
            return (
              <button
                key={group}
                type="button"
                data-tooltip={group}
                className={`admin-rail-btn${isGroupActive ? " is-active" : ""}`}
                tabIndex={-1}
                aria-hidden
              >
                <SvgIcon d={iconPath} size={19} />
              </button>
            );
          })}

          {/* Bas : déconnexion */}
          <div className="admin-rail-bottom">
            <div className="admin-rail-sep" />
          </div>
        </div>

        {/* ── Panneau de labels (colonne droite claire) ── */}
        <div className="admin-nav-panel">
          <div className="admin-nav-panel-inner">
            {groups.map((group) => (
              <div key={group} className="admin-nav-group">
                <p className="admin-nav-group-label">{group}</p>
                <ul className="admin-nav-list">
                  {modules
                    .filter((m) => m.group === group)
                    .map((m) =>
                      m.ready ? (
                        <li key={m.href}>
                          <Link
                            href={m.href}
                            aria-current={m.href === activeHref ? "page" : undefined}
                            className="admin-nav-link"
                          >
                            <span className="admin-nav-link-icon">
                              <SvgIcon
                                d={MODULE_ICONS[m.href] ?? "M4 6h16M4 10h16M4 14h16M4 18h16"}
                                size={14}
                              />
                            </span>
                            <span className="admin-nav-link-text">{m.label}</span>
                          </Link>
                        </li>
                      ) : (
                        <li
                          key={m.href}
                          className="admin-nav-item-disabled"
                          title="Module en cours de développement"
                        >
                          <span className="admin-nav-link-icon" style={{ opacity: 0.4 }}>
                            <SvgIcon
                              d={MODULE_ICONS[m.href] ?? "M4 6h16M4 10h16M4 14h16M4 18h16"}
                              size={14}
                            />
                          </span>
                          <span className="admin-nav-link-text">{m.label}</span>
                          <span className="admin-nav-item-soon">bientôt</span>
                        </li>
                      )
                    )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Bouton toggle mobile (utilisé dans le layout header) */}
      <button
        id="admin-sidebar-toggle"
        type="button"
        className="admin-mobile-toggle print:hidden"
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={18} height={18} aria-hidden>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={18} height={18} aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </>
  );
}
