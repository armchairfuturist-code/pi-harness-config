#!/bin/bash
# Primary metric for tool-result-clear campaign.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$REPO/bench/measure-pruner.sh" "${1:-3}"
