#!/bin/bash
# Builds the two upload archives for cPanel hosting:
#   dist/backend.tar.gz   Laravel API  -> extract into ~/laravel_app
#   dist/frontend.tar.gz  Next.js app  -> extract into the Node.js app root
#
# Everything heavy happens here, so the (I/O- and memory-limited) host only extracts files.
#
# Usage (Git Bash, from the repo root):
#   PHP_BIN=/d/xampp/php84/php.exe COMPOSER_PHAR=/c/ProgramData/ComposerSetup/bin/composer.phar bash deploy/build-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_PHAR="${COMPOSER_PHAR:-composer.phar}"

rm -rf "$DIST" && mkdir -p "$DIST"

if [ ! -f "$ROOT/frontend/.env.production" ]; then
  echo "Missing frontend/.env.production - copy deploy/frontend.env.production.example first." >&2
  exit 1
fi

echo "==> Backend: production dependencies in a clean copy"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

(cd "$ROOT/backend" && tar \
  --exclude=./vendor --exclude=./.env --exclude=./.env.* --exclude=./tests \
  --exclude=./storage/logs --exclude=./storage/framework/cache --exclude=./storage/framework/sessions \
  --exclude=./storage/framework/views --exclude=./node_modules --exclude=./.git --exclude=./database/*.sqlite \
  -cf - .) | tar -xf - -C "$TMP"

mkdir -p "$TMP/storage/logs" "$TMP/storage/framework/cache/data" "$TMP/storage/framework/sessions" "$TMP/storage/framework/views" "$TMP/bootstrap/cache"
(cd "$TMP" && "$PHP_BIN" "$COMPOSER_PHAR" install --no-dev --optimize-autoloader --no-interaction --prefer-dist)
tar -czf "$DIST/backend.tar.gz" -C "$TMP" .

echo "==> Frontend: production build"
(cd "$ROOT/frontend" && npm ci && npm run build)

STANDALONE="$ROOT/frontend/.next/standalone"
if [ ! -f "$STANDALONE/server.js" ]; then
  echo "standalone/server.js not found - check output: \"standalone\" in next.config.ts" >&2
  exit 1
fi

mkdir -p "$STANDALONE/.next"
cp -r "$ROOT/frontend/.next/static" "$STANDALONE/.next/static"
cp -r "$ROOT/frontend/public" "$STANDALONE/public"
tar -czf "$DIST/frontend.tar.gz" -C "$STANDALONE" .

echo
echo "Done:"
ls -lh "$DIST"
