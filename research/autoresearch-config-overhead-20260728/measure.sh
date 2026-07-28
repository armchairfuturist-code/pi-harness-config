#!/bin/bash
# measure.sh — fixed-overhead benchmark for the pi harness config.
# Builds a variant agent dir from the current repo working tree, runs the
# 1-request probe (bench/probe-variant.sh), emits METRIC name=value lines.
#
# Primary metric: probe_total — sum of input+cacheRead+cacheWrite tokens for
# one trivial request. Lower is better. Deterministic modulo provider caching;
# if a keep/discard decision is marginal, re-run rather than guessing.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- fast pre-checks (<1s): catch broken edits before spending an LLM request ---
jq -e . "$REPO/settings.json" >/dev/null          # valid JSON
[ -s "$REPO/APPEND_SYSTEM.md" ]                    # overlay non-empty
[ -f "$REPO/skills/ce-lite/SKILL.md" ]             # orchestrator skill present
[ -f "$REPO/lean-ctx/pi-config.json" ]             # lean-ctx bridge config present

bash "$REPO/.auto/proxy.sh" ensure   # measurement must go through the proxy
VAGENT="$(bash "$REPO/.auto/build-variant.sh")"

out="$(bash "$REPO/bench/probe-variant.sh" "$VAGENT" 2>&1)" || {
  echo "PROBE FAILED (variant may not boot):"; echo "$out" | tail -5; exit 1; }
echo "$out" | grep -q 'PROBE total=' || {
  echo "PROBE OUTPUT UNPARSEABLE:"; echo "$out" | tail -5; exit 1; }

total=$(echo "$out" | grep -oP 'total=\K[0-9]+' | tail -1)
reqs=$(echo "$out" | grep -oP 'requests=\K[0-9]+' | tail -1)
append_tok=$(( $(wc -c < "$REPO/APPEND_SYSTEM.md") / 4 ))
pkgs=$(jq '.packages | length' "$REPO/settings.json")
exts=$(jq '.extensions | length' "$REPO/settings.json")

echo "METRIC probe_total=$total"
echo "METRIC probe_requests=$reqs"
echo "METRIC append_tokens=$append_tok"
echo "METRIC package_count=$pkgs"
echo "METRIC extension_count=$exts"
