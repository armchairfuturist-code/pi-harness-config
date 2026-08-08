#!/usr/bin/env sh
# Pi harness: runtime tuning exports (+ lean-ctx token reduction).
# ------------------------------------------------------------------
# These are *runtime* environment variables, read when the agent/shell starts,
# not part of the agent's on-disk config. They are machine-level, so they live
# in a repo file but get applied to your shell rc rather than ~/.pi/agent/.
#
# `install.sh` deploys this file to ~/.config/lean-ctx/env.tuning.sh
# Apply it to this machine by adding one line to your shell rc
# ($HOME/.bashrc, $HOME/.zshrc, or fish: `bass source ...` / fish-compatible export):
#
#   source "$HOME/.config/lean-ctx/env.tuning.sh"
#
# What each variable does:
#   PI_TRANSCRIPT_PRUNE           Enable the transcript-pruner extension
#                                (DEDUP / STALE / CLEAR passes).
#   PI_PRUNE_KEEP                 How many of the most-recent FULL tool results the
#                                CLEAR pass keeps full. LOCKED at 4 (HIL Iter 9b
#                                live-keep-ab: keep3 only 5.8% better than keep4,
#                                below the 10% bar). Do not change without HIL.
#   LEAN_CTX_EPHEMERAL_MIN_TOKENS Token threshold at which lean-ctx swaps a tool
#                                output to an inline summary + ref instead of
#                                embedding it verbatim. Set to 1000 (2026-08-07).
#                                Full text stays re-addressable via ref.
#   PI_PRUNE_STATE                (optional) Where the transcript-pruner writes
#                                runtime-cleared stats. Default:
#                                ~/.local/state/pi/prune-events.jsonl

export PI_TRANSCRIPT_PRUNE=1
export PI_PRUNE_KEEP=4
export LEAN_CTX_EPHEMERAL_MIN_TOKENS=1000
# export PI_PRUNE_STATE="$HOME/.local/state/pi/prune-events.jsonl"
