import "server-only";
import type { BiometricCheckResult } from "@/lib/biometrics-rules";

/**
 * Vérification biométrique — point d'intégration d'un prestataire (lecteur d'empreintes + service de comparaison).
 *
 * AUCUN prestataire n'est intégré : `biometricProvider()` renvoie null et les opérations sont refusées avec un
 * message explicite. La gestion des licences fonctionne sans biométrie (contrôle d'identité sur pièces).
 *
 * Principes retenus (docs/biometrie.md) :
 *  - la capture et la comparaison se font chez le prestataire ; la plateforme ne reçoit ni ne stocke
 *    d'empreinte ni de gabarit, seulement une référence opaque et le résultat (correspondance ou non) ;
 *  - consentement explicite du joueur (ou de son représentant légal) avant tout enrôlement ;
 *  - activation seulement après validation réglementaire et accord de la fédération (BIOMETRIC_PROVIDER).
 */
export type BiometricProvider = {
  /** Identifiant court du prestataire (journalisé avec chaque opération). */
  id: string;
  /** Enrôle le joueur : renvoie la référence opaque du gabarit chez le prestataire. */
  enroll(input: { playerFederalId: string; deviceId: string }): Promise<{ providerRef: string }>;
  /** Compare une capture à l'enrôlement existant. */
  verify(input: { providerRef: string; deviceId: string }): Promise<{ result: BiometricCheckResult; providerRef?: string }>;
};

/** Adaptateurs disponibles, à compléter lors de l'intégration (un fichier par prestataire). */
const PROVIDERS: Record<string, () => BiometricProvider> = {};

export function biometricProvider(): BiometricProvider | null {
  const id = process.env.BIOMETRIC_PROVIDER?.trim();
  if (!id) return null;
  const factory = PROVIDERS[id];
  return factory ? factory() : null;
}

export const BIOMETRIC_UNAVAILABLE =
  "Vérification biométrique non disponible : aucun prestataire n'est intégré ni configuré (BIOMETRIC_PROVIDER). L'identité se contrôle sur pièces.";
