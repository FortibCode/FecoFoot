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
| `npm run test:run` | Tests automatisés (Vitest) |
| `npm run typecheck` | Vérification des types |
| `npm run lint` | ESLint |
| `npm run db:generate` | Génère une migration SQL après modification de `lib/db/schema.ts` |

## Organisation du code

| Dossier | Contenu |
|---|---|
| `app/` | Pages et Server Actions (`admin/` = espace fédéral) |
| `lib/auth/` | Profils et droits, session, verrouillage, contrôles serveur |
| `lib/db/` | Schéma et connexion à la base |
| `drizzle/` | Migrations SQL versionnées |
| `scripts/` | Migration et initialisation de la base |
| `tests/` | Tests automatisés |
