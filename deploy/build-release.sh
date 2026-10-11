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
  --exclude=./public/storage --exclude=./storage/app/public --exclude=./storage/logs --exclude=./storage/framework/cache --exclude=./storage/framework/sessions \
  --exclude=./storage/framework/views --exclude=./node_modules --exclude=./.git --exclude=./database/*.sqlite \
  -cf - .) | tar -xf - -C "$TMP"

mkdir -p "$TMP/storage/logs" "$TMP/storage/framework/cache/data" "$TMP/storage/framework/sessions" "$TMP/storage/framework/views" "$TMP/bootstrap/cache"
(cd "$TMP" && "$PHP_BIN" "$COMPOSER_PHAR" install --no-dev --optimize-autoloader --no-interaction --prefer-dist)
tar -czf "$DIST/backend.tar.gz" -C "$TMP" .
# Uploaded images (products, banners) are shipped separately: large, and rarely change.
if [ -d "$ROOT/backend/storage/app/public" ]; then tar -czf "$DIST/media.tar.gz" -C "$ROOT/backend/storage/app/public" .; fi

echo "==> Frontend: production build"
# .env.local outranks .env.production in Next's env loading; hide it so the build
# bakes in the production URLs, and put it back afterwards.
if [ -f "$ROOT/frontend/.env.local" ]; then
  mv "$ROOT/frontend/.env.local" "$ROOT/frontend/.env.local.release-bak"
  trap 'mv "$ROOT/frontend/.env.local.release-bak" "$ROOT/frontend/.env.local" 2>/dev/null; rm -rf "$TMP"' EXIT
fi
(cd "$ROOT/frontend" && if [ "${SKIP_NPM_CI:-0}" != "1" ]; then npm ci; fi && npm run build)

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
