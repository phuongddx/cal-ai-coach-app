#!/usr/bin/env bash
# Nightly PostgreSQL backup for the compose stack, run from the VPS host.
#
#   deploy/backup.sh backup                      pg_dump (custom format) into $BACKUP_DIR, keep 14 days
#   deploy/backup.sh restore FILE [DATABASE]     restore FILE into DATABASE (default: coachcal_restore_test)
#   deploy/backup.sh verify FILE                 restore into a scratch database, count rows, drop it
#
# Cron (as the user that runs docker), every night at 03:10:
#   10 3 * * * /srv/coachcal/apps/api/deploy/backup.sh backup >> /var/log/coachcal-backup.log 2>&1
#
# Restoring over the live database `coachcal` needs CONFIRM=yes: stop the api first
# (docker compose stop api caddy) and start it again afterwards.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PG_USER="${POSTGRES_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HERE/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE=(docker compose)
pg() { "${COMPOSE[@]}" exec -T postgres "$@"; }

backup() {
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  local file="$BACKUP_DIR/coachcal-$(date -u +%Y%m%d-%H%M%S).dump"
  # Dump to a temp name first: a failed dump never leaves a file that looks like a good backup.
  pg pg_dump -U "$PG_USER" --format=custom --compress=6 coachcal >"$file.partial"
  mv "$file.partial" "$file"
  chmod 600 "$file"
  echo "[backup] wrote $file ($(wc -c <"$file" | tr -d ' ') bytes)"
  find "$BACKUP_DIR" -maxdepth 1 -name 'coachcal-*.dump' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/[backup] pruned /'
}

restore() {
  local file="${1:?usage: backup.sh restore FILE [DATABASE]}" target="${2:-coachcal_restore_test}"
  [ -f "$file" ] || { echo "[restore] no such file: $file" >&2; exit 1; }
  if [ "$target" = coachcal ] && [ "${CONFIRM:-}" != yes ]; then
    echo "[restore] refusing to overwrite the live database; stop api and caddy, then rerun with CONFIRM=yes" >&2
    exit 1
  fi
  if [ "$target" != coachcal ]; then
    pg psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$target\"" -c "CREATE DATABASE \"$target\""
  fi
  # --clean --if-exists makes a restore over an existing database idempotent; ownership and grants come back with the dump.
  pg pg_restore -U "$PG_USER" --dbname "$target" --clean --if-exists --exit-on-error <"$file"
  echo "[restore] restored $file into $target"
}

verify() {
  local file="${1:?usage: backup.sh verify FILE}" scratch=coachcal_restore_verify
  restore "$file" "$scratch"
  pg psql -U "$PG_USER" -d "$scratch" -At -c \
    "SELECT 'users=' || (SELECT count(*) FROM public.users) || ' sessions=' || (SELECT count(*) FROM public.auth_sessions) || ' diary_entries=' || (SELECT count(*) FROM public.diary_entries) || ' migrations=' || (SELECT count(*) FROM public.schema_migrations)"
  pg psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$scratch\"" >/dev/null
  echo "[verify] ok, scratch database dropped"
}

case "${1:-}" in
  backup) backup ;;
  restore) shift; restore "$@" ;;
  verify) shift; verify "$@" ;;
  *) echo "usage: backup.sh backup | restore FILE [DATABASE] | verify FILE" >&2; exit 2 ;;
esac
