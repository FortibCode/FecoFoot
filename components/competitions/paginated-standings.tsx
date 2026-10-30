"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { orderStandings, StandingsTable, type StandingsRow } from "@/components/competitions/standings-table";

const PAGE_SIZE = 5;
const INTERVAL_MS = 6000;
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * Classement par pages de 5 équipes, qui défilent automatiquement (6 s par page).
 * Le défilement s'arrête au survol, au focus clavier, si l'onglet est masqué ou si l'appareil
 * demande moins d'animations ; boutons précédent / suivant et numéros de page.
 */
export function PaginatedStandings({
  rows,
  logos,
  title,
  zones,
}: {
  rows: StandingsRow[];
  logos?: Record<number, string>;
  title?: string;
  zones?: { promotion: number; relegation: number };
}) {
  const pages = Math.max(1, Math.ceil(orderStandings(rows).ordered.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [hold, setHold] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pages < 2 || hold || reduced) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setPage((p) => (p + 1) % pages);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [pages, hold, reduced]);

  const go = (p: number) => {
    setPage((p + pages) % pages);
  };
  const start = page * PAGE_SIZE;
  const total = orderStandings(rows).ordered.length;

  return (
    <div
      ref={root}
      className="flex flex-col gap-3"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
    >
      {/* key : les lignes de la nouvelle page sont recréées et entrent en glissant depuis la gauche
          (un décalage vers la droite ferait apparaître une barre de défilement dans le tableau). */}
      <StandingsTable key={page} rows={rows} logos={logos} title={title} animate slice={{ start, end: start + PAGE_SIZE }} enter="left" zones={zones} />
      {pages > 1 && (
        <nav aria-label="Pages du classement" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground" aria-live="polite">
            Équipes {start + 1} à {Math.min(start + PAGE_SIZE, total)} sur {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => go(page - 1)} aria-label="Page précédente" className="flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-foreground hover:text-background">
              ←
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Page ${i + 1}`}
                aria-current={i === page ? "page" : undefined}
                className={`relative flex size-9 items-center justify-center overflow-hidden rounded-md border font-semibold transition-colors ${
                  i === page ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {i + 1}
                {/* Progression jusqu'à la page suivante. */}
                {i === page && !hold && !reduced && (
                  <span
                    key={page}
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--flag-yellow)]"
                    style={{ animation: `standings-progress ${INTERVAL_MS}ms linear forwards` }}
                  />
                )}
              </button>
            ))}
            <button type="button" onClick={() => go(page + 1)} aria-label="Page suivante" className="flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-foreground hover:text-background">
              →
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
