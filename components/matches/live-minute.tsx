"use client";

import { useEffect, useState } from "react";
import { liveMinute, type MatchPeriod } from "@/lib/competitions";

/**
 * Minute de jeu d'un match en cours : calculée au serveur, puis avancée dans le navigateur toutes les
 * 15 s (sans requête). Mi-temps ou chronomètre inconnu : le libellé fourni.
 */
export function LiveMinute({ period, startedAt, initial, fallback }: { period: MatchPeriod | null; startedAt: string | null; initial: string | null; fallback: string }) {
  const [minute, setMinute] = useState(initial);
  useEffect(() => {
    if (!period || !startedAt) return;
    const id = setInterval(() => setMinute(liveMinute(period, new Date(startedAt))), 15_000);
    return () => clearInterval(id);
  }, [period, startedAt]);
  return <>{minute ?? fallback}</>;
}
