# Déploiement et exploitation — plateforme FECOFOOT

Procédure de déploiement, de sauvegarde et de restauration (cahier des charges §8.2, ENF-05 à ENF-09).

## 1. Environnements (ENF-08)

| Environnement | Rôle | Base | Paiements / SMS |
|---|---|---|---|
| Développement | Poste du développeur (`npm run dev`) | PostgreSQL locale | `simulation` / `log` |
| Recette | Validation des lots par la FECOFOOT (§10.2) | Base dédiée, données de démonstration | `simulation` / `log`, puis environnements de test des opérateurs |
| Production | Service officiel | Base dédiée, sauvegardée | `live` / `live` une fois les contrats signés |

Chaque environnement a son propre serveur (ou machine virtuelle), son propre fichier `.env.production` et ses propres secrets.
**Ne jamais réutiliser un `AUTH_SECRET` ou un mot de passe de base d'un environnement à l'autre.**

## 2. Prérequis du serveur

- Linux avec Docker et Docker Compose ;
- un nom de domaine pointant vers le serveur (ex. `www.fecofoot.cg`) ;
- un proxy inverse HTTPS devant l'application (Caddy conseillé : certificat automatique) ;
- un disque ou un emplacement distinct pour les sauvegardes, copié **hors du serveur** (autre site, stockage objet).

## 3. Premier déploiement

```bash
git clone <dépôt> fecofoot && cd fecofoot/fecofoot-platform
cp .env.production.example .env.production   # puis compléter (secrets : openssl rand …)
docker compose build
docker compose up -d
docker compose logs -f migrate                # migrations + 12 ligues + 6 sélections + super administrateur
curl -s http://127.0.0.1:3000/api/sante       # {"status":"ok","database":"ok",…}
```

Proxy inverse (exemple Caddy, `/etc/caddy/Caddyfile`) :

```
www.fecofoot.cg {
  reverse_proxy 127.0.0.1:3000
}
```

L'application n'écoute que sur `127.0.0.1:3000` : elle n'est joignable que par le proxy.
Avec `APP_URL` en `https://…`, elle envoie HSTS et impose HTTPS pour toutes les ressources (ENF-09).

Après le premier démarrage : se connecter avec le super administrateur, **activer sa double authentification**,
puis retirer `SEED_ADMIN_PASSWORD` de `.env.production`.

## 4. Mise à jour

```bash
git pull
docker compose build
docker compose up -d        # le service « migrate » applique les nouvelles migrations avant le redémarrage de l'application
```

Avant toute mise à jour majeure : sauvegarde manuelle (§5), tests de charge (`npm run test:load`, ENF-04) sur la recette.

**Retour arrière** : revenir à la version précédente (`git checkout <version>`), reconstruire, et si une migration a modifié
la base de façon incompatible, restaurer la sauvegarde faite avant la mise à jour (§6).

## 5. Sauvegardes (ENF-06)

Le service `backup` sauvegarde chaque nuit à 02:00 (heure de Brazzaville) :

- la base : `fecofoot-AAAAMMJJ-HHMMSS.dump` (format PostgreSQL compressé) ;
- les fichiers téléversés (photos, pièces, visuels) : `fichiers-AAAAMMJJ-HHMMSS.tar.gz`.

Juste après la sauvegarde, le journal d'audit est purgé des entrées plus anciennes que `AUDIT_RETENTION_DAYS`
(5 ans par défaut, 0 = conservation illimitée — EF-AUD-02) ; avant purge, l'exporter si besoin
(Administration › Journal d'audit › Exporter).

Les sauvegardes sont conservées 30 jours dans `BACKUP_HOST_DIR`. **Ce dossier doit être copié chaque jour hors du serveur.**

Sauvegarde manuelle :

```bash
docker compose exec backup /ops/backup.sh /backups
```

## 6. Restauration

```bash
docker compose stop app
docker compose exec backup /ops/restore.sh /backups/fecofoot-AAAAMMJJ-HHMMSS.dump /backups/fichiers-AAAAMMJJ-HHMMSS.tar.gz
docker compose start app
```

Le script demande de taper « oui » : la base est **remplacée**.
(Les fichiers téléversés sont restaurés dans le volume si le conteneur `backup` y a accès en écriture : retirer `:ro` le temps de l'opération.)

## 7. Test de restauration trimestriel (ENF-06)

```bash
docker compose exec backup /ops/restore-test.sh /backups
```

La dernière sauvegarde est restaurée dans une base **temporaire**, contrôlée (tables, ligues, migrations), puis supprimée.
La base de production n'est pas touchée. Consigner la date et le résultat. Ce test est aussi exécuté automatiquement
à chaque intégration continue (GitHub Actions).

## 8. Supervision (ENF-05, ENF-07)

- **Disponibilité** : surveiller `https://www.fecofoot.cg/api/sante` toutes les minutes avec un service de supervision
  externe (réponse 200 attendue ; 503 = base injoignable) et alerter par SMS / e-mail l'équipe d'astreinte.
- **Conteneurs** : Docker relance automatiquement l'application et vérifie sa santé (`HEALTHCHECK`).
- **Erreurs** : `docker compose logs app` ; à brancher sur un outil de centralisation des journaux.
- **Sécurité** : le journal d'audit (Administration › Journal d'audit) trace connexions, refus et opérations sensibles.

## 9. Avant la mise en production (Lot 4)

- [ ] Test d'intrusion par un tiers (ENF-14) et correction des points relevés.
- [ ] Contrats Airtel Money / MTN MoMo, puis `PAYMENT_MODE=live` (implémentation dans `lib/payments.ts`).
- [ ] Opérateur SMS et service d'e-mail, puis `NOTIFY_MODE=live` (implémentation dans `lib/notify.ts`).
- [ ] Reprise des données officielles (clubs, joueurs, licences en cours).
- [ ] Validation juridique sur les données personnelles (§6 du cahier des charges).
- [ ] Copie hors site des sauvegardes en place et premier test de restauration consigné.
