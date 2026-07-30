#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT/diagnostics/generated-visibility"
DIST_DIR="$ROOT/dist"
ARCHIVE="$DIST_DIR/Crown-of-Ash-visibility-isolation-v1.zip"

node "$ROOT/tools/build-visibility-tests.mjs"
mkdir -p "$DIST_DIR"

(
  cd "$OUTPUT_DIR"
  zip -r -X -FS "$ARCHIVE" . \
    -x ".DS_Store" "*/.DS_Store"
)

unzip -t "$ARCHIVE"
printf 'Built %s\n' "$ARCHIVE"
