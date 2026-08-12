#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACTION="${1:-}"
NAME="${2:-}"
PROFILE="$ROOT/profiles/$NAME.json"
[[ "$ACTION" =~ ^(enable|disable)$ && -f "$PROFILE" ]] || {
  echo "usage: $0 enable|disable research|audit" >&2; exit 2;
}
mapfile -t SPECS < <(jq -r '.packages[]' "$PROFILE")
for spec in "${SPECS[@]}"; do
  if [[ "$ACTION" == enable ]]; then pi install "$spec"
  else pi remove "$spec" || true
  fi
done
echo "$NAME profile $ACTION complete; restart Pi and run harness-preflight."
