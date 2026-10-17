"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; group: string; ready: boolean };

/**
 * Menu des modules : rubrique en cours mise en évidence (préfixe le plus long) ;
 * sur téléphone, replié derrière un bouton pour laisser la page en premier.
 */
export function AdminNav({ modules }: { modules: Item[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Fermé à chaque changement de page (ajustement au rendu, sans effet).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const active = modules
    .filter((m) => m.ready && (pathname === m.href || (m.href !== "/admin" && pathname.startsWith(`${m.href}/`))))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const groups = [...new Set(modules.map((m) => m.group))];

  return (
    <nav aria-label="Modules" className="border-b bg-muted/50 md:w-60 md:shrink-0 md:border-r md:border-b-0 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold md:hidden"
      >
        {modules.find((m) => m.href === active)?.label ?? "Menu"}
        <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      <div className={`${open ? "block" : "hidden"} px-3 pb-4 md:block md:py-5`}>
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <p className="mb-1 px-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group}</p>
            <ul className="flex flex-col gap-0.5">
              {modules
                .filter((m) => m.group === group)
                .map((m) =>
                  m.ready ? (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        aria-current={m.href === active ? "page" : undefined}
                        className={`block rounded-md border-l-[3px] px-2 py-1.5 text-sm transition-colors ${
                          m.href === active
                            ? "border-[var(--flag-green)] bg-card font-semibold text-foreground shadow-sm"
                            : "border-transparent text-foreground/80 hover:bg-card hover:text-foreground"
                        }`}
                      >
                        {m.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={m.href} className="px-2 py-1.5 text-sm text-muted-foreground" title="Module en cours de développement">
                      {m.label}
                    </li>
                  ),
                )}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
