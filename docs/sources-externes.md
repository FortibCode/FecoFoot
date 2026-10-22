# Sources sportives externes (scores et calendriers)

La plateforme peut importer le calendrier et les scores d'une compétition depuis **API-Football**
(api-sports.io), qui référence la Ligue 1 de la République du Congo. La saisie officielle de la fédération
reste prioritaire.

## Règles appliquées (lib/external-sync-rules.ts)

- Un résultat **validé** par l'organisateur n'est jamais modifié. Un écart devient un **conflit** à examiner
  (Administration › Sources externes).
- Une feuille de match **saisie officiellement** (statut ou buts saisis par le commissaire) prime aussi.
- Un score importé porte la provenance « externe ». Un match terminé reste « en attente de validation »
  et ne compte au classement qu'après validation.
- Aucune équipe inconnue n'est créée : chaque équipe du fournisseur est associée à un club par un responsable.
- Une date ou un stade fixé par un responsable n'est jamais remplacé.

## Mise en service

1. Créer un compte sur api-football.com. Avec l'offre gratuite (environ 100 requêtes par jour), vérifier la couverture
   de la ligue : calendrier, scores, direct, buteurs.
2. Ajouter la clé à l'environnement du serveur : `API_FOOTBALL_KEY=…` (jamais dans le code ni dans le dépôt).
3. Dans Gestion sportive › Sources externes :
   1. rechercher la ligue (pays « Congo ») ;
   2. la lier à la saison de la plateforme ;
   3. associer les équipes aux clubs ;
   4. synchroniser.
4. Direct : définir `SYNC_SECRET` puis planifier l'appel, par exemple toutes les 2 minutes pendant les journées de match :

   ```cron
   */2 * * * 5-0 curl -fsS -X POST -H "Authorization: Bearer $SYNC_SECRET" https://<domaine>/api/integrations/sync
   ```

   Une synchronisation consomme une requête par compétition liée. Adapter la fréquence au quota de l'abonnement :
   toutes les 15 minutes tient dans l'offre gratuite ; le direct à la minute demande une offre payante.

## À vérifier avant la mise en production

- Les conditions d'utilisation du fournisseur pour l'affichage public des données.
- La couverture réelle de la saison en cours (matchs reportés, retards de mise à jour).
