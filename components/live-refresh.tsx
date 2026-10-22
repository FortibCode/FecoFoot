"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Score en direct sur le portail : tant qu'un match est en cours sur la page, ses données sont relues
 * toutes les `seconds` secondes (scores saisis par le commissaire au stade). Pause quand l'onglet est
 * masqué ou que le téléphone est hors ligne : aucune requête inutile sur les connexions lentes.
 */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  // Heure fixée seulement côté navigateur (après une actualisation) : le rendu serveur et l'hydratation restent identiques.
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") {
        router.refresh();
        setAt(new Date());
      }
    }, seconds * 1000);
    // Retour sur l'onglet : actualisation immédiate plutôt que d'attendre le prochain tour.
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
        setAt(new Date());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span aria-hidden className="size-2 animate-pulse rounded-full bg-[var(--flag-red,#dc241f)]" />
      En direct · actualisé automatiquement toutes les {seconds} s
      {at && ` (dernière mise à jour ${at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Brazzaville" })})`}
    </p>
  );
}
