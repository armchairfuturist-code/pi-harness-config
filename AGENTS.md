# Pi agent home

This is the Pi agent harness directory (`~/.pi/agent`).

**Harness contract (SoT):** [HARNESS.md](./HARNESS.md) — skills policy, tools, extensions, session hygiene, git, preflight.

**CE-lite strip:** [APPEND_SYSTEM.md](./APPEND_SYSTEM.md) — triggers only; do not duplicate tool policy here.

## Quick pointers

- Prefer `ctx_*` tools; never `python -c` / shell heredoc into interpreters.
- `last30days` is on-demand (not always-on tokens). Load only when researching recent discourse.
- Before commit: `scripts/harness-preflight.sh`
- After skill/ext changes: `python3 skills/harness-doctor/scripts/inventory.py`

## Custom agents

- `agents/Explore.md` — general explore path.
- Add specialized agents only with a clear tool allowlist and purpose.
