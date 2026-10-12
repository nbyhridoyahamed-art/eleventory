#!/bin/bash
# Uploads the release archives to the cPanel host over FTP (explicit TLS).
# Passwords are typed at the prompt - never stored, never passed on the command line history.
#
# Usage (Git Bash, from the repo root):
#   bash deploy/upload-ftp.sh                 # API + media + frontend
#   ONLY=frontend bash deploy/upload-ftp.sh   # frontend archive only
#   SKIP_MEDIA=1 bash deploy/upload-ftp.sh    # API code + frontend (typical release; images unchanged)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
HOST="${FTP_HOST:-jamuna.whitelabelverse.com}"

API_USER="${API_FTP_USER:-deploy@mobilecover.com.bd}"     # FTP root = /home/mobileco/laravel_app
WEB_USER="${WEB_FTP_USER:-deploy2@mobilecover.com.bd}"    # FTP root = /home/mobileco/elevendollar.store

for f in frontend.tar.gz; do
  [ -f "$DIST/$f" ] || { echo "Missing $DIST/$f - run deploy/build-release.sh first." >&2; exit 1; }
done

upload() { # user password file
  echo "  -> $3"
  curl --ssl-reqd --insecure --ftp-pasv --fail --progress-bar \
    --user "$1:$2" -T "$DIST/$3" "ftp://$HOST/$3"
}

if [ "${ONLY:-all}" != "frontend" ]; then
  read -r -s -p "FTP password for $API_USER (laravel_app): " API_PASS; echo
  echo "Uploading API archives..."
  upload "$API_USER" "$API_PASS" backend.tar.gz
  if [ "${SKIP_MEDIA:-0}" != "1" ]; then upload "$API_USER" "$API_PASS" media.tar.gz; fi
  unset API_PASS
fi

read -r -s -p "FTP password for $WEB_USER (elevendollar.store): " WEB_PASS; echo
echo "Uploading frontend archive..."
upload "$WEB_USER" "$WEB_PASS" frontend.tar.gz
unset WEB_PASS

echo
echo "Uploaded. Tell Claude 'uploaded' - the archives are extracted from cPanel File Manager."
