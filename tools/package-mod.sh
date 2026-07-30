#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOD_DIR="$ROOT/Crown of Ash"
DIST_DIR="$ROOT/dist"
ARCHIVE="$DIST_DIR/Crown-of-Ash-v1.0.1.zip"

node "$ROOT/tools/validate-rms.mjs"
mkdir -p "$DIST_DIR"

(
  cd "$MOD_DIR"
  zip -r -X -FS "$ARCHIVE" info.json resources \
    -x ".DS_Store" "*/.DS_Store"
)

unzip -t "$ARCHIVE"
printf 'Built %s\n' "$ARCHIVE"
