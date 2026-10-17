#!/usr/bin/env bash
# Sauvegarde quotidienne (ENF-06) : base PostgreSQL (format personnalisé, compressé) + fichiers téléversés.
# Conservation : BACKUP_RETENTION_DAYS jours (30 par défaut). Usage : DATABASE_URL=… ops/backup.sh [dossier]
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit être défini}"
DEST="${1:-${BACKUP_DIR:-/backups}}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
UPLOADS="${UPLOAD_DIR:-uploads}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

pg_dump --format=custom --compress=6 --no-owner --file "$DEST/fecofoot-$STAMP.dump.partial" "$DATABASE_URL"
mv "$DEST/fecofoot-$STAMP.dump.partial" "$DEST/fecofoot-$STAMP.dump"
if [[ -d "$UPLOADS" ]]; then
  tar -czf "$DEST/fichiers-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
fi

# Conservation du journal d'audit (EF-AUD-02) : AUDIT_RETENTION_DAYS jours, purgé APRÈS la sauvegarde
# (les entrées supprimées restent dans les sauvegardes précédentes). 0 ou vide : conservation illimitée.
AUDIT_DAYS="${AUDIT_RETENTION_DAYS:-0}"
if [[ "$AUDIT_DAYS" =~ ^[0-9]+$ && "$AUDIT_DAYS" -gt 0 ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
    "delete from audit_logs where created_at < now() - interval '$AUDIT_DAYS days'" >/dev/null
  echo "Journal d'audit : entrées de plus de $AUDIT_DAYS jours purgées."
fi

# Rotation : suppression des sauvegardes de plus de RETENTION jours.
find "$DEST" -maxdepth 1 -type f \( -name 'fecofoot-*.dump' -o -name 'fichiers-*.tar.gz' \) -mtime "+$RETENTION" -delete
echo "Sauvegarde terminée : $DEST/fecofoot-$STAMP.dump ($(du -h "$DEST/fecofoot-$STAMP.dump" | cut -f1))"
