#!/bin/sh

set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

case "$PUID$PGID" in
  ''|*[!0-9]*)
    echo "PUID and PGID must be numeric (got PUID=$PUID, PGID=$PGID)" >&2
    exit 1
    ;;
esac

mkdir -p /usr/src/app/data/app /usr/src/app/logs
chown -R "$PUID:$PGID" /usr/src/app/data/app /usr/src/app/logs

exec su-exec "$PUID:$PGID" "$@"
