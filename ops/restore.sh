#!/usr/bin/env bash
# Restauration d'une sauvegarde (ENF-06). ÉCRASE la base cible : confirmation obligatoire.
# Usage : DATABASE_URL=… ops/restore.sh /backups/fecofoot-AAAAMMJJ-HHMMSS.dump [archive-fichiers.tar.gz]
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit être défini}"
DUMP="${1:?Indiquez le fichier de sauvegarde à restaurer}"
FILES="${2:-}"
[[ -f "$DUMP" ]] || { echo "Fichier introuvable : $DUMP" >&2; exit 1; }

if [[ "${CONFIRM:-}" != "oui" ]]; then
  read -r -p "La base ciblée par DATABASE_URL va être REMPLACÉE par $DUMP. Taper « oui » pour continuer : " answer
  [[ "$answer" == "oui" ]] || { echo "Abandon."; exit 1; }
fi
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname "$DATABASE_URL" "$DUMP"
if [[ -n "$FILES" ]]; then
  tar -xzf "$FILES" -C "$(dirname "${UPLOAD_DIR:-uploads}")"
fi
echo "Restauration terminée depuis $DUMP."
