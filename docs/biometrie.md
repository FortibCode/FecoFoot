# Biométrie des licences — architecture prévue (non activée)

La plateforme gère les licences **sans** biométrie : l'identité du joueur est contrôlée **sur pièces**
(photo, acte de naissance, pièce d'identité) par un agent habilité, qui le confirme au moment de la validation.
Ce contrôle est tracé (qui, quand, comment) et c'est lui seul qui fait apparaître « Identité vérifiée » sur la carte.

## Ce qui est en place

| Élément | Rôle |
| --- | --- |
| `lib/biometrics.ts` | Interface `BiometricProvider` (enrôlement, vérification) et sélection du prestataire par `BIOMETRIC_PROVIDER`. Aucun adaptateur : toute opération est refusée avec un message explicite. |
| `biometric_enrollments` | Référence **opaque** du gabarit chez le prestataire, date du consentement, retrait. Aucune empreinte, aucun gabarit. |
| `biometric_checks` | Résultat d'une vérification (correspondance / pas de correspondance / erreur), contexte, agent. |
| `players.identity_method` | `DOCUMENTS` aujourd'hui ; `BIOMETRIC` quand une vérification réelle aura réussi. |

## Avant toute activation

1. Base légale et analyse d'impact : données biométriques = données sensibles (loi congolaise sur la protection
   des données personnelles, et règlement de la fédération) ; finalité, durée de conservation, droits des joueurs.
2. Choix d'un prestataire qui capture et compare **chez lui** (la plateforme ne reçoit que la référence et le résultat),
   avec chiffrement, journalisation et engagement de suppression.
3. Consentement explicite du joueur (représentant légal pour un mineur), révocable.
4. Écrire l'adaptateur (`lib/biometrics/<prestataire>.ts`), l'enregistrer dans `PROVIDERS`, renseigner
   `BIOMETRIC_PROVIDER` et les identifiants du prestataire dans l'environnement.

Tant que ces points ne sont pas validés, aucune icône ni mention « biométrique » n'est affichée.
