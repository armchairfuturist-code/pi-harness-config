#!/bin/bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CTX_MODE_ADMIN_TOOLS=0

# ---- Run probe (fixed overhead: system prompt + tool schemas) ----
probe_result=$(bash "$REPO/bench/probe.sh" 2>&1)
probe_tokens=$(echo "$probe_result" | grep -oP 'total=\K[0-9]+')
echo "METRIC probe_tokens=$probe_tokens"

# ---- Run bench workload (correctness + full session tokens) ----
bench_output=$(bash "$REPO/bench/measure.sh" 1 2>&1)
bench_tokens=$(echo "$bench_output" | grep -oP 'totalInputTokens=\K[0-9]+' | head -1)
checks_pass=$(echo "$bench_output" | grep -oP 'checks_pass=\K[0-9]' | head -1)
echo "METRIC bench_tokens=$bench_tokens"
echo "METRIC checks_pass=${checks_pass:-0}"

# ---- Current config value ----
current_chars=$(jq -r '.aggressiveMaxDescChars' "$HOME/.pi/tscg.json")
echo "METRIC current_max_desc_chars=$current_chars"
