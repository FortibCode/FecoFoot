"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Actualise les données de la page à intervalle régulier (tant que le poste est en ligne). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
