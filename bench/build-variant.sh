#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_AGENT="${PI_LIVE_AGENT:-$HOME/.pi/agent}"
VHOME="${PI_VARIANT_HOME:-$(mktemp -d "${TMPDIR:-/tmp}/pi-harness-home.XXXXXX") }"
VHOME="${VHOME% }"
VAGENT="$VHOME/.pi/agent"
mkdir -p "$VAGENT/extensions/pi-lean-ctx" "$VAGENT/sessions" "$VHOME/.config/lean-ctx" "$VHOME/.pi/workflows/saved"

node "$ROOT/scripts/validate-manifest.mjs" >&2
PI_AGENT_HOME="$LIVE_AGENT" node "$ROOT/scripts/verify-package-lock.mjs" >&2

cp "$ROOT/settings.json" "$VAGENT/settings.json"
cp "$ROOT/APPEND_SYSTEM.md" "$VAGENT/APPEND_SYSTEM.md"
cp "$ROOT/HARNESS.md" "$VAGENT/HARNESS.md"
cp "$ROOT/AGENTS.md" "$VAGENT/AGENTS.md"
cp "$ROOT/model-thinking.json" "$VAGENT/model-thinking.json"
cp "$ROOT/packages.lock.json" "$VAGENT/packages.lock.json"
cp "$ROOT/tscg.json" "$VHOME/.pi/tscg.json"
cp -a "$ROOT/skills" "$VAGENT/skills"
cp "$ROOT/lean-ctx/pi-config.json" "$VAGENT/extensions/pi-lean-ctx/config.json"
cp "$ROOT/lean-ctx/config.toml" "$VHOME/.config/lean-ctx/config.toml"
for file in transcript-pruner.ts session-index.ts runtime-discipline.ts; do cp "$ROOT/extensions/$file" "$VAGENT/extensions/$file"; done
# Extension support files (e.g. lib/prune-core.mjs imported by transcript-pruner.ts).
# Copy the whole lib/ dir so relative imports resolve in the variant home.
if [[ -d "$ROOT/extensions/lib" ]]; then mkdir -p "$VAGENT/extensions/lib"; cp -R "$ROOT/extensions/lib/." "$VAGENT/extensions/lib/"; fi

# Snapshot installed packages; never symlink mutable live node_modules.
mkdir -p "$VAGENT/npm"
cp -a --reflink=auto "$LIVE_AGENT/npm/." "$VAGENT/npm/"
cp "$LIVE_AGENT/models.json" "$VAGENT/models.json"
cp "$LIVE_AGENT/auth.json" "$VAGENT/auth.json"
chmod 600 "$VAGENT/auth.json" "$VAGENT/models.json"
PORT="${PI_BENCH_PORT:-4599}"
jq --arg url "http://127.0.0.1:$PORT/v1" '.providers.Venice.baseUrl=$url' "$VAGENT/models.json" > "$VAGENT/models.tmp" && mv "$VAGENT/models.tmp" "$VAGENT/models.json"

# pi-lean-ctx #930 compatibility path.
mkdir -p "$VAGENT/agent/extensions/pi-lean-ctx"
cp "$ROOT/lean-ctx/pi-config.json" "$VAGENT/agent/extensions/pi-lean-ctx/config.json"

PI_AGENT_HOME="$VAGENT" bash "$ROOT/scripts/apply-package-patches.sh" >&2
PI_AGENT_HOME="$VAGENT" node "$ROOT/scripts/verify-package-lock.mjs" >&2

commit=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo dirty)
config_hash=$(sha256sum "$ROOT/settings.json" "$ROOT/APPEND_SYSTEM.md" "$ROOT/tscg.json" "$ROOT/packages.lock.json" | sha256sum | cut -c1-12)
jq -n --arg commit "$commit" --arg configHash "$config_hash" --arg home "$VHOME" \
  --slurpfile settings "$VAGENT/settings.json" --slurpfile lock "$ROOT/packages.lock.json" \
  '{commit:$commit,configHash:$configHash,variantHome:$home,settings:$settings[0],packages:$lock[0]}' > "$VHOME/.pi/variant-manifest.json"
printf '%s\n' "$VAGENT"
