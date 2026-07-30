#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT/diagnostics/generated"
DIST_DIR="$ROOT/dist"
ARCHIVE="$DIST_DIR/Crown-of-Ash-feature-isolation-v1.zip"

node "$ROOT/tools/build-feature-tests.mjs"
mkdir -p "$DIST_DIR"

(
  cd "$OUTPUT_DIR"
  zip -r -X -FS "$ARCHIVE" . \
    -x ".DS_Store" "*/.DS_Store"
)

unzip -t "$ARCHIVE"
printf 'Built %s\n' "$ARCHIVE"
