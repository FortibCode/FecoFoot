"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Onglets (catégories de l'accueil, rubriques de la fiche d'un match). Tous les panneaux sont rendus par le serveur : changer
 * d'onglet est immédiat, sans requête. Clavier : flèches gauche / droite, Début, Fin.
 */
export function MatchTabs({ tabs, initial, label = "Catégories de matchs" }: { tabs: { id: string; label: string; live?: boolean; panel: ReactNode }[]; initial: string; label?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const j = (next + tabs.length) % tabs.length;
    setActive(tabs[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${selected ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:bg-muted"}`}
            >
              {t.live && <span aria-label="match en direct" className="size-2 rounded-full bg-[var(--flag-red)] motion-safe:animate-pulse" />}
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={t.id !== active} tabIndex={0} className="focus-visible:outline-none">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
