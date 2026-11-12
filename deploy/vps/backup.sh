#!/usr/bin/env bash
# Whole-database backup, encrypted, with retention. Run nightly from the host's cron:
#   15 3 * * *  /opt/eleventory/deploy/vps/backup.sh >> /var/log/eleventory-backup.log 2>&1
#
# Needs: docker compose, openssl. Optional: rclone (set BACKUP_REMOTE, e.g. r2:eleventory-backups)
# to copy the file off the server; a backup that lives only on the server it protects is not a backup.
#
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in X.sql.gz.enc | gunzip | \
#           docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" "$DB_DATABASE"
# Rehearse that on a scratch machine regularly (RUNBOOK.md, "Restore drill").
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE in .env (different from APP_KEY, stored off the server too)}"
DIR="${BACKUP_DIR:-/var/backups/eleventory}"
KEEP_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$DIR/db-$STAMP.sql.gz.enc"

mkdir -p "$DIR"; umask 077
docker compose exec -T mariadb mariadb-dump -uroot -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines --triggers "$DB_DATABASE" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE"

# A dump that is empty or truncated is worse than none: check it before trusting it.
[ "$(stat -c%s "$FILE")" -gt 1024 ] || { echo "backup $FILE is suspiciously small" >&2; exit 1; }
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$FILE" | gunzip | tail -c 200 | grep -q "Dump completed" \
  || { echo "backup $FILE did not end with 'Dump completed'" >&2; exit 1; }

[ -n "${BACKUP_REMOTE:-}" ] && rclone copy "$FILE" "$BACKUP_REMOTE"
find "$DIR" -name 'db-*.sql.gz.enc' -mtime +"$KEEP_DAYS" -delete
echo "ok $FILE"
