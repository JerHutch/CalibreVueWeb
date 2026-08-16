#!/bin/sh

set -eu

mkdir -p /usr/src/app/data/app /usr/src/app/logs
chown -R node:node /usr/src/app/data/app /usr/src/app/logs

exec su-exec node "$@"
