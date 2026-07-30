#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT/diagnostics/generated-elevation"
DIST_DIR="$ROOT/dist"
ARCHIVE="$DIST_DIR/Crown-of-Ash-elevation-isolation-v1.zip"

node "$ROOT/tools/build-elevation-tests.mjs"
mkdir -p "$DIST_DIR"

(
  cd "$OUTPUT_DIR"
  zip -r -X -FS "$ARCHIVE" . \
    -x ".DS_Store" "*/.DS_Store"
)

unzip -t "$ARCHIVE"
printf 'Built %s\n' "$ARCHIVE"
