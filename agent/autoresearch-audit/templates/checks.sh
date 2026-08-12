#!/bin/bash
set -euo pipefail
# Enhanced checks.sh template — backpressure checks that run after every
# passing benchmark. Failures block 'keep' and auto-revert changes.
#
# Anti-overfitting: these checks ensure optimizations don't break correctness.
# Keep output minimal — only the last 80 lines are fed back to the agent.

# --- Tests ---
if [ -f package.json ]; then
  pnpm test --run --reporter=dot 2>&1 | tail -50
fi

# --- Type checking ---
if [ -f tsconfig.json ] || [ -f package.json ]; then
  pnpm typecheck 2>&1 | grep -i error || true
fi

# --- Lint (errors only) ---
if [ -f .eslintrc.* ] || [ -f eslint.config.* ]; then
  pnpm lint 2>&1 | grep -iE "error|problem" | tail -20 || true
fi

# --- Custom project checks ---
# Add project-specific correctness checks here:
# - Database migrations apply cleanly
# - Config files validate
# - Critical paths produce expected output
# - No new compiler warnings introduced
