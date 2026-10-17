# FECOFOOT — Plateforme numérique

Plateforme de la Fédération Congolaise de Football : licences, clubs, compétitions, arbitrage,
équipes nationales, billetterie, supporters, accréditations médias et portail public.
Référence fonctionnelle : *Cahier des charges v1.0* (septembre 2026).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL · Drizzle ORM ·
Tailwind CSS 4 + shadcn · Vitest.

## Démarrage

```bash
npm install
npm run setup                 # crée la base PostgreSQL et .env, migre, crée les ligues et l'admin
npm run dev                   # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run test:run` | Tests unitaires (Vitest) : règles de gestion, sécurité des actions serveur |
| `npm run test:e2e` | Parcours de bout en bout (Playwright, Chromium en taille téléphone) ; données « E2E » supprimées à la fin |
| `npm run test:load` | Tests de charge de la billetterie (ENF-02, ENF-03), avant chaque mise en service majeure |
| `npm run actualites:import` | Reprise des actualités de l'ancien site fecofoot.cg (tout l'historique, sans doublon) ; ensuite, bouton « Synchroniser avec fecofoot.cg » dans Administration › Actualités |
| `npm run photos:import -- <dossier> --equipe a --une fichier.jpg` | Import en lot dans la photothèque (légendes facultatives dans `<dossier>/legendes.json`) ; en production, utiliser Administration › Photothèque |
| `npm run typecheck` | Vérification des types |
| `npm run lint` | ESLint |
| `npm run db:generate` | Génère une migration SQL après modification de `lib/db/schema.ts` |

## Déploiement

Docker (`Dockerfile`, `docker-compose.yml`) : base PostgreSQL 16, migrations, application, sauvegardes quotidiennes.
Procédure complète, restauration et supervision : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

## Intégration continue

À chaque push sur `main` et à chaque demande de fusion, GitHub Actions (`.github/workflows/ci.yml`) vérifie les types,
le lint, les tests unitaires et la construction, puis rejoue les parcours de bout en bout sur une base PostgreSQL éphémère.

## Modes de développement

| Variable | Valeur locale | Effet |
|---|---|---|
| `PAYMENT_MODE` | `simulation` | Paiements Mobile Money simulés (page de confirmation), aucun débit réel |
| `NOTIFY_MODE` | `log` | SMS et e-mails enregistrés (Administration › Notifications), rien n'est envoyé |
| `TWO_FACTOR_REQUIRED_ROLES` | vide | Double authentification facultative en local ; obligatoire par défaut en production |

## Organisation du code

| Dossier | Contenu |
|---|---|
| `app/` | Pages et Server Actions (`admin/` = espace fédéral) |
| `lib/auth/` | Profils et droits, session, verrouillage, contrôles serveur |
| `lib/db/` | Schéma et connexion à la base |
| `drizzle/` | Migrations SQL versionnées |
| `scripts/` | Migration et initialisation de la base |
| `tests/` | Tests automatisés |
