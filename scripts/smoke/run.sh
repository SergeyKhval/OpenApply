#!/usr/bin/env bash
# Prod smoke test (oa-ocf). Runs HTTP + rendered-page checks against a live
# OpenApply deployment and writes screenshots + a pass/fail summary to the
# growth sprint vault. Exits non-zero if any check fails.
#
# Usage:
#   scripts/smoke/run.sh [base-url]
#
# Env overrides:
#   SMOKE_OUT_ROOT   directory to write <timestamp>/ report dirs into
#                     (default: the growth-sprint-2026-09/smoke/ vault folder)
#   CHROME_PATH      headless Chrome binary (default: /usr/bin/google-chrome)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_URL="${1:-https://openapply.app}"
DEFAULT_OUT_ROOT="$HOME/Documents/Obsidian Vault/Projects/OpenApply/growth-sprint-2026-09/smoke"
OUT_ROOT="${SMOKE_OUT_ROOT:-$DEFAULT_OUT_ROOT}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT_DIR="$OUT_ROOT/$TIMESTAMP"

mkdir -p "$OUT_DIR"

export ASDF_NODEJS_VERSION="${ASDF_NODEJS_VERSION:-22.22.2}"

echo "OpenApply prod smoke test"
echo "  base URL: $BASE_URL"
echo "  report:   $OUT_DIR"
echo ""

set +e
node "$SCRIPT_DIR/check.mjs" --base-url "$BASE_URL" --out-dir "$OUT_DIR"
STATUS=$?
set -e

exit "$STATUS"
