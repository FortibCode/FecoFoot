#!/usr/bin/env bash
# Prépare l'environnement de développement local :
#   1. crée l'utilisateur et la base PostgreSQL « fecofoot » (demande le mot de passe sudo) ;
#   2. écrit le fichier .env (secrets générés aléatoirement) ;
#   3. applique les migrations et crée les 11 ligues départementales + le super administrateur.
# Sans effet destructeur : ne touche ni à un .env existant, ni à une base existante.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo "Un fichier .env existe déjà : il est conservé."
else
  db_password=$(openssl rand -hex 16)
  admin_password="Fecofoot-$(openssl rand -hex 6)"

  echo "→ Création de l'utilisateur et de la base PostgreSQL « fecofoot » (mot de passe sudo demandé)…"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fecofoot') THEN
    CREATE ROLE fecofoot LOGIN PASSWORD '${db_password}';
  ELSE
    ALTER ROLE fecofoot WITH LOGIN PASSWORD '${db_password}';
  END IF;
END
\$\$;
SQL
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'fecofoot'" | grep -q 1; then
    sudo -u postgres createdb -O fecofoot fecofoot
  fi

  cat > .env <<ENV
DATABASE_URL=postgres://fecofoot:${db_password}@127.0.0.1:5432/fecofoot
AUTH_SECRET=$(openssl rand -base64 32)
SEED_ADMIN_EMAIL=admin@fecofoot.cg
SEED_ADMIN_NAME="Administrateur plateforme"
SEED_ADMIN_PASSWORD=${admin_password}
APP_URL=http://localhost:3000
ENV
  chmod 600 .env
  echo "→ Fichier .env créé."
fi

npm run --silent db:migrate
npm run --silent db:seed

echo
echo "Terminé. Connexion : http://localhost:3000/connexion"
echo "  E-mail       : $(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2-)"
echo "  Mot de passe : $(grep '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2-)"
