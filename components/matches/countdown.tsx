"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
};

/** Temps restant avant le coup d'envoi (« dans 14 jours », « dans 3 h »), calculé dans le navigateur. */
export function Countdown({ at }: { at: string }) {
  // Minute courante : identique entre deux rendus d'une même minute ; rien côté serveur (pas d'écart d'heure).
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60_000), () => null);
  if (now === null) return null;
  const minutes = Math.round(new Date(at).getTime() / 60_000 - now);
  if (minutes <= 0) return null;
  const label =
    minutes < 60
      ? `dans ${minutes} min`
      : minutes < 24 * 60
        ? `dans ${Math.round(minutes / 60)} h`
        : `dans ${Math.round(minutes / (24 * 60))} jour${Math.round(minutes / (24 * 60)) > 1 ? "s" : ""}`;
  return <span className="rounded bg-brand-ink px-2 py-0.5 text-xs font-semibold text-white">{label}</span>;
}
