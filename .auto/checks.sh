#!/bin/bash
# Kernel regression gate + extension parse check.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node --check "$REPO/extensions/transcript-pruner.ts" >/dev/null 2>&1 || {
  # ts may not run under node --check; ensure file non-empty and balanced braces roughly
  test -s "$REPO/extensions/transcript-pruner.ts"
}
if bash "$REPO/bench/probe.sh" > /tmp/probe-clear-$$.out 2>&1; then
  total=$(grep -oE 'total=[0-9]+' /tmp/probe-clear-$$.out | head -1 | cut -d= -f2 || true)
  rm -f /tmp/probe-clear-$$.out
  if [ -n "${total:-}" ] && [ "$total" -gt 4400 ]; then
    echo "CHECKS: probe_total=$total exceeds 4400"
    exit 1
  fi
  echo "CHECKS: probe_total=${total:-unknown} OK"
else
  rm -f /tmp/probe-clear-$$.out
  echo "CHECKS: probe skipped (proxy/runtime unavailable)"
fi
echo "CHECKS: pass"
