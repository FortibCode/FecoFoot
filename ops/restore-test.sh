#!/usr/bin/env bash
# Test de restauration trimestriel (ENF-06) : la dernière sauvegarde est restaurée dans une base
# TEMPORAIRE, contrôlée, puis supprimée. La base de production n'est jamais touchée.
# Usage : DATABASE_URL=… ops/restore-test.sh [dossier des sauvegardes]
# DATABASE_URL doit pointer vers un compte ayant le droit de créer une base.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit être défini}"
DIR="${1:-${BACKUP_DIR:-/backups}}"
LATEST="$(ls -1t "$DIR"/fecofoot-*.dump 2>/dev/null | head -1 || true)"
[[ -n "$LATEST" ]] || { echo "Aucune sauvegarde dans $DIR" >&2; exit 1; }

TMPDB="fecofoot_restore_test_$(date +%s)"
ADMIN_URL="${DATABASE_URL%/*}/postgres"
TMP_URL="${DATABASE_URL%/*}/$TMPDB"
cleanup() { psql "$ADMIN_URL" -q -c "drop database if exists $TMPDB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN_URL" -q -c "create database $TMPDB"
pg_restore --no-owner --exit-on-error --dbname "$TMP_URL" "$LATEST"

echo "Sauvegarde testée : $LATEST"
for table in users leagues clubs players licenses competitions matches supporters tickets audit_logs; do
  printf '  %-14s %s lignes\n' "$table" "$(psql "$TMP_URL" -tAc "select count(*) from $table")"
done
LEAGUES="$(psql "$TMP_URL" -tAc "select count(*) from leagues")"
MIGRATIONS="$(psql "$TMP_URL" -tAc "select count(*) from drizzle.__drizzle_migrations")"
[[ "$LEAGUES" -ge 11 && "$MIGRATIONS" -ge 1 ]] || { echo "ÉCHEC : sauvegarde incomplète." >&2; exit 1; }
echo "RESTAURATION OK ($MIGRATIONS migrations, $LEAGUES ligues)."
