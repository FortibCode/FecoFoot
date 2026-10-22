"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MODULE_ICONS } from "@/lib/module-icons";

type Item = { href: string; label: string; group: string; section?: string; ready: boolean };

/** Groupe → icône représentative du rail */
const GROUP_ICONS: Record<string, string> = {
  "Tableau de bord":        "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  "Gestion sportive":       "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "Communication":          "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  "Services et finances":   "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  "Administration système": "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
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
 * Barre latérale de l'espace fédéral : une rubrique par groupe, en menu déroulant.
 * La rubrique de la page en cours est ouverte d'office ; les autres s'ouvrent au clic.
 * Sur téléphone, la barre s'ouvre en tiroir depuis le bouton flottant.
 */
export function AdminNav({ modules, brand }: { modules: Item[]; brand?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Module actif (préfixe le plus long).
  const activeHref = modules
    .filter((m) => m.ready && (pathname === m.href || (m.href !== "/admin" && pathname.startsWith(`${m.href}/`))))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const groups = [...new Set(modules.map((m) => m.group))];
  const activeGroup = modules.find((m) => m.href === activeHref)?.group;

  // Rubriques dépliées : celle de la page en cours au départ, puis selon les clics.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : groups.slice(0, 1)));

  // Changement de page : tiroir mobile refermé, rubrique de la nouvelle page dépliée (ajustement au rendu, sans effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    if (activeGroup && !expanded.has(activeGroup)) setExpanded(new Set([...expanded, activeGroup]));
  }

  const toggle = (group: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <>
      <div className={`admin-sidebar-overlay${open ? " is-open" : ""}`} onClick={() => setOpen(false)} aria-hidden />

      <nav aria-label="Modules" className={`admin-sidebar${open ? " is-open" : ""} print:hidden`}>
        {brand && <div className="admin-sidebar-brand">{brand}</div>}
        <div className="admin-sidebar-scroll">
          {groups.map((group) => {
            const items = modules.filter((m) => m.group === group);
            const isOpen = expanded.has(group);
            const isActive = group === activeGroup;
            const panelId = `admin-nav-${group.replace(/\W+/g, "-").toLowerCase()}`;
            // Rubrique à un seul module (Pilotage) : lien direct, sans menu déroulant.
            if (items.length === 1 && items[0].ready) {
              const m = items[0];
              return (
                <Link
                  key={group}
                  href={m.href}
                  aria-current={m.href === activeHref ? "page" : undefined}
                  className={`admin-nav-group-btn admin-nav-single${isActive ? " is-active" : ""}`}
                >
                  <span className="admin-nav-group-icon">
                    <SvgIcon d={MODULE_ICONS[m.href] ?? GROUP_ICONS[group] ?? "M4 6h16M4 12h16M4 18h16"} size={20} />
                  </span>
                  <span className="admin-nav-group-text">{m.label}</span>
                </Link>
              );
            }
            return (
              <div key={group} className={`admin-nav-group${isOpen ? " is-open" : ""}${isActive ? " is-active" : ""}`}>
                <button type="button" className="admin-nav-group-btn" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(group)}>
                  <span className="admin-nav-group-icon">
                    <SvgIcon d={GROUP_ICONS[group] ?? "M4 6h16M4 12h16M4 18h16"} size={20} />
                  </span>
                  <span className="admin-nav-group-text">{group}</span>
                  <svg className="admin-nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div id={panelId} className="admin-nav-dropdown" hidden={!isOpen}>
                  <ul className="admin-nav-list">
                    {items.map((m, i) =>
                      m.ready ? (
                        <li key={m.href}>
                          {m.section && m.section !== items[i - 1]?.section && <span className="admin-nav-section">{m.section}</span>}
                          <Link href={m.href} aria-current={m.href === activeHref ? "page" : undefined} className="admin-nav-link">
                            <span className="admin-nav-link-icon">
                              <SvgIcon d={MODULE_ICONS[m.href] ?? "M4 6h16M4 12h16M4 18h16"} size={17} />
                            </span>
                            <span className="admin-nav-link-text">{m.label}</span>
                          </Link>
                        </li>
                      ) : (
                        <li key={m.href} className="admin-nav-item-disabled" title="Module en cours de développement">
                          <span className="admin-nav-link-icon">
                            <SvgIcon d={MODULE_ICONS[m.href] ?? "M4 6h16M4 12h16M4 18h16"} size={17} />
                          </span>
                          <span className="admin-nav-link-text">{m.label}</span>
                          <span className="admin-nav-item-soon">bientôt</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
        <div className="admin-sidebar-flag" aria-hidden />
      </nav>

      <button
        id="admin-sidebar-toggle"
        type="button"
        className="admin-mobile-toggle print:hidden"
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={20} height={20} aria-hidden>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={20} height={20} aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </>
  );
}
