"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Clubs suivis par le visiteur : mémorisés dans son navigateur (aucun compte, aucune donnée envoyée).
 * Navigation privée ou stockage bloqué : la fonction se désactive sans erreur.
 */
const KEY = "fecofoot:clubs-suivis";
const EVENT = "fecofoot:clubs-suivis";
const EMPTY: number[] = [];
let cache: { raw: string | null; ids: number[] } = { raw: null, ids: EMPTY };

function read(): number[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cache.raw) {
      const parsed = raw ? JSON.parse(raw) : [];
      cache = { raw, ids: Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : EMPTY };
    }
    return cache.ids;
  } catch {
    return EMPTY;
  }
}

function write(ids: number[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Stockage indisponible : le suivi reste valable le temps de la page.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useFollowedClubs() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Étoile « Suivre ce club ». */
export function FollowClubButton({ clubId, name, tone = "light" }: { clubId: number; name: string; tone?: "light" | "dark" }) {
  const followed = useFollowedClubs().includes(clubId);
  const colors =
    tone === "dark"
      ? followed
        ? "border-[var(--flag-yellow)] bg-[var(--flag-yellow)] text-brand-ink"
        : "border-white/40 text-white hover:bg-white/10"
      : followed
        ? "border-[var(--flag-yellow)] bg-[color-mix(in_srgb,var(--flag-yellow)_25%,transparent)]"
        : "bg-card hover:bg-muted";
  return (
    <button
      type="button"
      aria-pressed={followed}
      aria-label={followed ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      onClick={() => {
        const ids = read();
        write(followed ? ids.filter((id) => id !== clubId) : [...ids, clubId]);
      }}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${colors}`}
    >
      <span aria-hidden>{followed ? "★" : "☆"}</span>
      {followed ? "Suivi" : "Suivre"}
    </button>
  );
}

const any = (ids: number[], sel: (id: number) => string) => ids.map(sel).join(", ");

/** Étoile devant les clubs suivis, partout dans les listes de matchs de la page. */
export function FollowedMarks() {
  const ids = useFollowedClubs();
  if (ids.length === 0) return null;
  return <style>{`${any(ids, (id) => `[data-fav-mark="${id}"]`)} { display: inline; }`}</style>;
}

/**
 * Liste de matchs avec le filtre « Mes clubs » : ne garde que les rencontres des clubs suivis
 * (lignes, puis compétitions et jours qui n'en contiennent plus aucune).
 */
export function FavoritesScope({ children }: { children: ReactNode }) {
  const ids = useFollowedClubs();
  const [only, setOnly] = useState(false);
  const active = only && ids.length > 0;
  const mine = any(ids, (id) => `li[data-clubs~="${id}"]`);
  return (
    <div data-fav-only={active || undefined} className="flex flex-col gap-6">
      <FollowedMarks />
      {active && (
        <style>{`
          [data-fav-only] li:not(${ids.map((id) => `[data-clubs~="${id}"]`).join("):not(")}) { display: none; }
          [data-fav-only] [data-group]:not(:has(${mine})), [data-fav-only] [data-day]:not(:has(${mine})), [data-fav-only] [data-section]:not(:has(${mine})) { display: none; }
          [data-fav-only]:not(:has(${mine})) [data-fav-empty] { display: block; }
        `}</style>
      )}
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={active}
            onClick={() => setOnly((v) => !v)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green ${active ? "border-[var(--flag-yellow)] bg-[color-mix(in_srgb,var(--flag-yellow)_25%,transparent)]" : "bg-card hover:bg-muted"}`}
          >
            <span aria-hidden className="text-[var(--flag-yellow)]">★</span>
            Mes clubs
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{ids.length}</span>
          </button>
          <span className="text-xs text-muted-foreground">Clubs suivis sur cet appareil</span>
        </div>
      )}
      <p data-fav-empty className="hidden rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aucun match de vos clubs suivis dans cette sélection.
      </p>
      {children}
    </div>
  );
}
