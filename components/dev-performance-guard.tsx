"use client";

/**
 * Développement uniquement : React enregistre la durée de rendu des composants avec performance.measure.
 * Pour une page serveur affichée juste après une action (formulaire puis redirection), l'heure de début
 * calculée peut être négative ; le navigateur rejette alors la mesure (« cannot have a negative time
 * stamp ») et Next.js affiche une erreur bloquante. Seule cette erreur de mesure est ignorée ; toute
 * autre erreur passe. Le module est retiré de la version de production (process.env.NODE_ENV).
 */
if (process.env.NODE_ENV === "development" && typeof performance !== "undefined" && typeof performance.measure === "function") {
  const measure = performance.measure.bind(performance);
  performance.measure = ((...args: Parameters<Performance["measure"]>) => {
    try {
      return measure(...args);
    } catch (e) {
      if (e instanceof TypeError && /negative time ?stamp/i.test(e.message)) return undefined as unknown as PerformanceMeasure;
      throw e;
    }
  }) as Performance["measure"];
}

export function DevPerformanceGuard() {
  return null;
}
