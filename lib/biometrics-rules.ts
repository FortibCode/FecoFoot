/**
 * Biométrie — règles pures (aucune dépendance serveur), partagées par le schéma et l'interface.
 * Aucun prestataire n'est intégré : voir lib/biometrics.ts et docs/biometrie.md.
 */
export const BIOMETRIC_CHECK_RESULTS = ["MATCH", "NO_MATCH", "ERROR"] as const;
export type BiometricCheckResult = (typeof BIOMETRIC_CHECK_RESULTS)[number];
export const BIOMETRIC_RESULT_LABELS: Record<BiometricCheckResult, string> = {
  MATCH: "Correspondance confirmée",
  NO_MATCH: "Pas de correspondance",
  ERROR: "Vérification impossible",
};

/**
 * Indicateur affiché sur la carte : uniquement ce qui a réellement eu lieu.
 * « biométrie » exige un contrôle biométrique concluant enregistré ; sinon « pièces » si l'agent a contrôlé l'identité.
 */
export function identityBadge(p: { identityVerifiedAt: Date | null; identityMethod: "DOCUMENTS" | "BIOMETRIC" | null }, lastBiometric: BiometricCheckResult | null) {
  if (lastBiometric === "MATCH") return "BIOMETRIC" as const;
  if (p.identityVerifiedAt) return "DOCUMENTS" as const;
  return null;
}
